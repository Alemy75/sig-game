const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const C = require('./core.js');
const ROOT = __dirname;
const types = {'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/aac':'aac','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm','video/ogg':'ogg','video/quicktime':'mov'};
function saveMedia(bytes, mime) {
  const ext = types[mime];
  if (!ext) throw Error('Неподдерживаемый формат медиа.');
  if (bytes.length > 30*1024*1024) throw Error('Максимум 30 МБ на файл.');
  const relative = 'uploads/'+crypto.createHash('sha256').update(bytes).digest('hex')+'.'+ext;
  fs.mkdirSync(path.join(ROOT,'uploads'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,relative),bytes);
  return relative;
}
function prepare(input) {
  const pack = C.validatePackage(input);
  let total = 0;
  for (const q of [...pack.rounds.flatMap(r=>r.themes.flatMap(t=>t.questions)), ...pack.finals]) {
    for (const m of [...q.media,...q.answerMedia]) {
      if (m.data.startsWith('data:')) {
        const [,mime,base64] = /^data:([^;]+);base64,(.*)$/.exec(m.data);
        m.data = saveMedia(Buffer.from(base64,'base64'),mime);
      }
      const filename = path.join(ROOT,m.data);
      if (!fs.existsSync(filename)) throw Error('Не найден файл '+m.data+'. Скопируйте папку uploads рядом с index.html.');
      const size = fs.statSync(filename).size;
      if(size>30*1024*1024) throw Error('Максимум 30 МБ на файл.');
      total += size;
      if(total>100*1024*1024) throw Error('Общий размер медиа превышает 100 МБ.');
    }
  }
  return pack;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for(const b of bytes){crc ^= b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function zip(entries) {
  const chunks=[], directory=[]; let offset=0;
  for(const [name,data] of entries){
    const n=Buffer.from(name), local=Buffer.alloc(30), central=Buffer.alloc(46), crc=crc32(data);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(33,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
    chunks.push(local,n,data);directory.push(central,n);offset+=local.length+n.length+data.length;
  }
  const dir=Buffer.concat(directory), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,dir,end]);
}
function exportPackage(input){
  const pack=prepare(input), names=new Set();
  for(const q of [...pack.rounds.flatMap(r=>r.themes.flatMap(t=>t.questions)),...pack.finals])for(const m of [...q.media,...q.answerMedia])names.add(m.data);
  return zip([['package.json',Buffer.from(JSON.stringify(pack,null,2))],['uploads/',Buffer.alloc(0)],...[...names].map(n=>[n,fs.readFileSync(path.join(ROOT,n))])]);
}
async function body(req,limit){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('Превышен размер запроса.');chunks.push(chunk);}return Buffer.concat(chunks);}
async function middleware(req,res,next){
  try{
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end();}
    const url=new URL(req.url,'http://'+req.headers.host);
    if(!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/')) return next();
    if(req.method==='POST'){
      if(req.headers.origin!=='http://'+req.headers.host){res.writeHead(403);return res.end();}
      if(url.pathname==='/api/upload'){
        const data=saveMedia(await body(req,30*1024*1024),req.headers['content-type']);
        res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data}));
      }
      const pack=JSON.parse((await body(req,145*1024*1024)).toString());
      if(url.pathname==='/api/prepare'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(prepare(pack)));}
      if(url.pathname==='/api/export'){res.setHeader('Content-Type','application/zip');return res.end(exportPackage(pack));}
      res.writeHead(404);return res.end();
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    if(!/^uploads\/[a-f0-9]{64}\.(png|jpg|gif|webp|mp3|wav|ogg|m4a|aac|webm|mp4|mov)$/.test(name)){res.writeHead(404);return res.end();}
    const file=path.join(ROOT,name);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
    const ext=path.extname(file).slice(1), mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',jpg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'application/ogg',m4a:'audio/mp4',aac:'audio/aac',webm:'video/webm',mp4:'video/mp4',mov:'video/quicktime'}[ext];
    const size=fs.statSync(file).size;let start=0,end=size-1;
    res.setHeader('Content-Type',mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');
    if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match || (start=Number(match[1]))>=size || (end=match[2]?Number(match[2]):size-1)<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}end=Math.min(end,size-1);res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
    res.setHeader('Content-Length',Math.max(0,end-start+1));if(req.method==='HEAD'||!size)return res.end();fs.createReadStream(file,{start,end}).pipe(res);
  }catch(err){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:err.message}));}
}
function createServer(){return http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));}
module.exports={prepare,exportPackage,createServer,middleware};
