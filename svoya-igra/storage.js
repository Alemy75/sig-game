/* IndexedDB holds embedded media. localStorage is a fallback for restricted file origins. */
(function(root){
'use strict';
const KEY='svoya-igra-v1';
let db=null, backend='memory', latest=null, queue=Promise.resolve();
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function open(){
  try {
    db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open(KEY,1);
      const timeout=setTimeout(()=>reject(new Error('Хранилище не отвечает')),2500);
      req.onupgradeneeded=()=>req.result.createObjectStore('data');
      req.onsuccess=()=>{clearTimeout(timeout);resolve(req.result);};
      req.onerror=()=>{clearTimeout(timeout);reject(req.error);};
      req.onblocked=()=>{clearTimeout(timeout);reject(new Error('Хранилище заблокировано'));};
    });
    backend='indexedDB';
    const saved=await request(db.transaction('data').objectStore('data').get('current'));
    if(saved) return saved;
    try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}
  }catch{
    db=null;
    try{localStorage.setItem(KEY+'-probe','1');localStorage.removeItem(KEY+'-probe');backend='localStorage';return JSON.parse(localStorage.getItem(KEY)||'null');}
    catch{backend='memory';return null;}
  }
}
function save(value){
  latest=value;
  const snapshot=structuredClone(value);
  const job=queue.catch(()=>{}).then(async()=>{
    if(db){
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('data','readwrite');
        tx.objectStore('data').put(snapshot,'current');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Запись отменена'));
      });
    } else if(backend==='localStorage') localStorage.setItem(KEY,JSON.stringify(snapshot));
    else throw new Error('Браузер запретил локальное сохранение. Экспортируйте пакет перед закрытием.');
  });
  queue=job; return job;
}
root.GameStorage={open,save,get backend(){return backend;},get latest(){return latest;}};
})(globalThis);
