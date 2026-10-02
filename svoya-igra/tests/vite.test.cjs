const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Vite dev and built preview keep JSON import, uploads and ZIP export',async()=>{
 const {createServer,preview,build}=await import('vite');
 const configFile=path.join(root,'vite.config.mjs');
 await build({root,configFile,logLevel:'silent'});
 const pack=JSON.parse(fs.readFileSync(path.join(root,'dump.json'),'utf8'));
 const media=pack.rounds.flatMap(r=>r.themes.flatMap(t=>t.questions)).flatMap(q=>q.media)[0];
 for(const mode of ['dev','preview']){
  const instance=mode==='dev'?await createServer({root,configFile,logLevel:'silent',server:{port:0}}):await preview({root,configFile,logLevel:'silent',preview:{port:0}});
  if(mode==='dev')await instance.listen();
  const origin='http://127.0.0.1:'+instance.httpServer.address().port;
  try{
   let r=await fetch(origin);assert.equal(r.status,200);const html=await r.text();assert.match(html,/type="module"/);
   const script=/<script[^>]+src="([^"]+)"/.exec(html)[1];r=await fetch(origin+script);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);
   r=await fetch(origin+'/'+media.data);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync(path.join(root,media.data)));
   for(const route of ['prepare','export']){r=await fetch(origin+'/api/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(pack)});assert.equal(r.status,200);if(route==='prepare')assert.deepEqual(await r.json(),pack);else assert.equal(Buffer.from(await r.arrayBuffer()).readUInt32LE(0),0x04034b50);}
  }finally{if(mode==='dev')await instance.close();else await new Promise(resolve=>instance.httpServer.close(resolve));}
 }
});
