const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../core.js');
const {createServer,prepare,exportPackage}=require('../server.cjs');
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dump.json'),'utf8'));
test('external media paths are preserved; unsafe paths rejected',()=>{
 const p=fixture();assert.deepEqual(C.validatePackage(p),p);
 const m=p.rounds.flatMap(r=>r.themes.flatMap(t=>t.questions)).flatMap(q=>q.media)[0];
 for(const value of ['uploads/../core.js','https://example.com/file.png','uploads/x.svg','uploads/"bad.png']){m.data=value;assert.throws(()=>C.validatePackage(p));}
});
test('missing media prevents import and export',()=>{
 const p=fixture();p.finals[0].media=[{kind:'image',name:'missing',data:'uploads/'+ '0'.repeat(64)+'.png'}];
 assert.throws(()=>prepare(p),/Не найден файл/);assert.throws(()=>exportPackage(p),/Не найден файл/);
});
test('HTTP upload, import, export, range playback and origin protection',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let uploaded;
 try{
  const post=(route,body,type='application/json',o=origin)=>fetch(origin+route,{method:'POST',headers:{Origin:o,'Content-Type':type},body});
  assert.equal((await fetch(origin+'/')).status,404);
  assert.equal((await post('/api/upload','x','image/png','https://example.com')).status,403);
  const bytes=Buffer.from('unique-test-'+Date.now());
  let r=await post('/api/upload',bytes,'image/png');assert.equal(r.status,200);uploaded=(await r.json()).data;
  assert.deepEqual(fs.readFileSync(path.join(__dirname,'..',uploaded)),bytes);
  r=await fetch(origin+'/'+uploaded,{headers:{Range:'bytes=1-3'}});assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(1,4));
  const p=fixture();p.finals[0].media=[{kind:'image',name:'test.png',data:uploaded}];
  r=await post('/api/prepare',JSON.stringify(p));assert.equal(r.status,200);assert.deepEqual(await r.json(),p);
  r=await post('/api/export',JSON.stringify(p));assert.equal(r.status,200);const archive=Buffer.from(await r.arrayBuffer());assert.equal(archive.readUInt32LE(0),0x04034b50);assert.ok(archive.includes(Buffer.from(uploaded)));assert.ok(archive.includes(Buffer.from('package.json')));
  assert.equal((await fetch(origin+'/server.cjs')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));if(uploaded)fs.unlinkSync(path.join(__dirname,'..',uploaded));}
});
