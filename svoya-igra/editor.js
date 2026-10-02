(function(root){
'use strict';
let round=0, theme=0, question=0, busy=false;
const uid=()=> 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const e=s=>root.App.escape(s);
const pack=()=>root.App.state.pack;
function current(){return round===2?pack().finals[theme]:pack().rounds[round].themes[theme].questions[question];}
function emptyQuestion(value=100,final=false){return {id:uid(),text:'',answer:'',seconds:final?60:20,media:[],answerMedia:[],...(final?{title:'Новая тема'}:{type:'normal',value})};}
function normalizeSelection(){
  const list=round===2?pack().finals:pack().rounds[round].themes;
  theme=Math.max(0,Math.min(theme,list.length-1));
  if(round!==2) question=Math.max(0,Math.min(question,list[theme].questions.length-1));
}
function attachments(q,key){return `<div class="attachment-list">${q[key].map((m,i)=>`<div class="attachment">${m.kind==='image'?`<img src="${m.data}" alt="${e(m.name)}">`:m.kind==='audio'?`<audio controls preload="none" src="${m.data}"></audio>`:`<video controls preload="metadata" src="${m.data}"></video>`}<div>${e(m.name)}</div><button class="button danger" data-action="ed-remove-media" data-key="${key}" data-index="${i}" type="button">Удалить файл</button></div>`).join('')}</div>`;}
function render(){
  normalizeSelection(); const p=pack(),q=current(),isFinal=round===2;
  return `<div class="page-heading"><div><div class="eyebrow">МАСТЕРСКАЯ ПАКЕТОВ</div><h1 style="margin-top:10px">Редактор игры</h1><p>Ваши темы, ваши вопросы. Изменения сохраняются автоматически.</p></div><button class="button subtle" data-action="home">← Главное меню</button></div>
  <div class="editor-toolbar"><label class="field">Название пакета<input maxlength="150" data-ed="package-title" value="${e(p.title)}"></label><div class="actions"><button class="button" data-action="import">↑ Импорт</button><button class="button" data-action="export">↓ Экспорт пакета</button><button class="button primary" data-action="setup">Начать игру →</button></div></div>
  <div class="editor-tabs" role="group" aria-label="Раунды">${['Раунд 1','Раунд 2','Финал'].map((name,i)=>`<button class="button ${round===i?'selected':''}" data-action="ed-round" data-index="${i}">${name}</button>`).join('')}</div>
  <div class="editor-layout"><aside class="editor-sidebar" aria-label="Темы и вопросы">${isFinal?p.finals.map((f,t)=>`<button class="editor-question ${theme===t?'active':''}" data-action="ed-select" data-theme="${t}" data-question="0"><b>${String(t+1).padStart(2,'0')}</b><span>${e(f.title)}</span></button>`).join(''):p.rounds[round].themes.map((t,ti)=>`<div class="editor-theme">${String(ti+1).padStart(2,'0')} · ${e(t.title)}</div>${t.questions.map((item,qi)=>`<button class="editor-question ${theme===ti&&question===qi?'active':''}" data-action="ed-select" data-theme="${ti}" data-question="${qi}"><b>${item.value}</b><span>${item.type==='cat'?'◆ ':item.type==='auction'?'↗ ':''}${e(item.text||'Новый вопрос')}</span></button>`).join('')}`).join('')}<button class="button subtle compact" style="width:100%;margin-top:15px" data-action="ed-add-theme">+ Добавить тему</button></aside>
  <section class="panel editor-pane" aria-label="Редактирование вопроса"><div class="row between" style="margin-bottom:20px"><span class="eyebrow">${isFinal?'ФИНАЛЬНАЯ ТЕМА':`ТЕМА ${theme+1} / ВОПРОС ${question+1}`}</span><button class="button subtle compact danger" data-action="ed-delete-theme">Удалить тему</button></div>
  <label class="field">Название темы<input data-ed="theme-title" maxlength="150" value="${e(isFinal?q.title:p.rounds[round].themes[theme].title)}"></label>
  <div class="field-row">${isFinal?'':`<label class="field">Тип вопроса<select data-ed="type"><option value="normal" ${q.type==='normal'?'selected':''}>Обычный</option><option value="cat" ${q.type==='cat'?'selected':''}>Кот в мешке</option><option value="auction" ${q.type==='auction'?'selected':''}>Аукцион</option></select></label><label class="field">Стоимость<input data-ed="value" type="number" min="1" max="1000000" step="1" value="${q.value}"></label>`}<label class="field">Таймер, секунд<input data-ed="seconds" type="number" min="1" max="3600" step="1" value="${q.seconds}"></label></div>
  <label class="field">Текст вопроса<textarea data-ed="text" maxlength="10000" placeholder="Что должны узнать игроки?">${e(q.text)}</textarea></label>
  <div class="row between"><span class="small muted">Медиа вопроса</span><label class="button compact subtle">+ Прикрепить файлы<input class="media-upload" data-key="media" type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/*,video/*" multiple hidden ${busy?'disabled':''}></label></div>${attachments(q,'media')}${q.media.length?'':'<p class="empty-hint">Изображения, аудио или видео. До 30 МБ на файл.</p>'}
  <div class="editor-section"><label class="field">Правильный ответ<textarea data-ed="answer" maxlength="10000" placeholder="Ответ и пояснение для ведущего">${e(q.answer)}</textarea></label><div class="row between"><span class="small muted">Медиа ответа</span><label class="button compact subtle">+ Прикрепить файлы<input class="media-upload" data-key="answerMedia" type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/*,video/*" multiple hidden ${busy?'disabled':''}></label></div>${attachments(q,'answerMedia')}</div>
  <div class="editor-footer">${isFinal?'<p class="help">Каждая финальная тема содержит один вопрос.</p>':`<button class="button compact" data-action="ed-add-question">+ Добавить вопрос</button><button class="button subtle compact danger" data-action="ed-delete-question">Удалить вопрос</button>`}</div><p class="help" style="margin:18px 0 0">Файлы включаются в пакет и доступны без интернета. Экспортируйте пакет, чтобы сохранить резервную копию.</p></section></div>`;
}
function input(target){
  const key=target.dataset.ed;if(!key)return;
  let value=target.value;
  if(['value','seconds'].includes(key)){
    if(!target.checkValidity()||value===''){target.setAttribute('aria-invalid','true');return;}
    value=Number(value);
  }
  target.removeAttribute('aria-invalid');
  if(key==='package-title') pack().title=value;
  else if(key==='theme-title'){if(round===2)current().title=value;else pack().rounds[round].themes[theme].title=value;}
  else current()[key]=value;
  root.App.persist();
}
async function click(action,target){
  if(busy){root.App.toast('Дождитесь добавления файлов.');return;}
  switch(action){
    case 'ed-round': round=Number(target.dataset.index);theme=question=0;break;
    case 'ed-select':theme=Number(target.dataset.theme);question=Number(target.dataset.question);break;
    case 'ed-add-theme':{
      const list=round===2?pack().finals:pack().rounds[round].themes;
      if(list.length>=20)throw new Error('Максимум 20 тем.');
      list.push(round===2?emptyQuestion(0,true):{id:uid(),title:'Новая тема',questions:Array.from({length:5},(_,i)=>emptyQuestion((round+1)*(i+1)*100))});theme=list.length-1;question=0;break;
    }
    case 'ed-delete-theme':{
      const list=round===2?pack().finals:pack().rounds[round].themes;
      if(list.length<=1)throw new Error('В раунде должна остаться хотя бы одна тема.');
      if(!await root.App.confirm('Удалить тему?', 'Все вопросы и медиа этой темы будут удалены из пакета.','Удалить'))return;
      list.splice(theme,1);theme=Math.max(0,theme-1);question=0;break;
    }
    case 'ed-add-question':{
      const qs=pack().rounds[round].themes[theme].questions;if(qs.length>=20)throw new Error('Максимум 20 вопросов в теме.');
      qs.push(emptyQuestion((round+1)*(qs.length+1)*100));question=qs.length-1;break;
    }
    case 'ed-delete-question':{
      const qs=pack().rounds[round].themes[theme].questions;if(qs.length<=1)throw new Error('В теме должен остаться хотя бы один вопрос.');
      if(!await root.App.confirm('Удалить вопрос?','Вопрос вместе с прикреплёнными файлами будет удалён.','Удалить'))return;
      qs.splice(question,1);question=Math.max(0,question-1);break;
    }
    case 'ed-remove-media':current()[target.dataset.key].splice(Number(target.dataset.index),1);break;
  }
  root.App.persist();root.App.render();
}
async function upload(target){
  const files=Array.from(target.files||[]);if(!files.length)return;
  const q=current(),key=target.dataset.key;
  if(q[key].length+files.length>8)throw new Error('Максимум 8 файлов для вопроса или ответа.');
  busy=true;target.disabled=true;root.App.toast('Добавляем файлы в пакет…');
  try{
    const added=[];
    for(const file of files){
      if(file.size>30*1024*1024)throw new Error(`«${file.name}»: размер больше 30 МБ.`);
      const {data}=await GameMedia.upload(file);
      added.push({kind:file.type.split('/')[0],name:file.name,data});
    }
    const draft=GameCore.clone(pack());
    const draftQ=round===2?draft.finals[theme]:draft.rounds[round].themes[theme].questions[question];draftQ[key].push(...added);
    await GameMedia.prepare(GameCore.validatePackage(draft)); q[key].push(...added);root.App.persist();root.App.toast('Файлы добавлены.');
  } finally {busy=false;target.disabled=false;target.value='';root.App.render();}
}
root.GameEditor={render,input,click,upload,reset(){round=theme=question=0;},get busy(){return busy;}};
})(globalThis);
