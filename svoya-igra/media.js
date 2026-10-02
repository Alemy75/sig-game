(function(root){
'use strict';
function requireServer(){if(location.protocol==='file:')throw new Error('Для загрузки медиа и экспорта выполните node start.js и откройте http://127.0.0.1:8787.');}
async function request(route,body,type='application/json'){
  requireServer();const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':type},body});
  if(!response.ok){let message='Ошибка локального сервера.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
  return response;
}
root.GameMedia={
  async upload(file){return (await request('upload',file,file.type)).json();},
  async prepare(pack){return (await request('prepare',JSON.stringify(pack))).json();},
  async download(pack){const response=await request('export',JSON.stringify(pack));const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=(pack.title||'Своя игра').replace(/[^а-яёa-z0-9 _-]/gi,'').slice(0,80)+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
};
})(globalThis);
