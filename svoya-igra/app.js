(function(root){
'use strict';
const C=GameCore;
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('ru-RU');
const state={pack:null,game:null,history:[],view:'home',teamCount:3,names:['Команда 1','Команда 2','Команда 3','Команда 4']};
let toastTimeout,saveTimeout,saveRevision=0,dialogHandler=null,confirmResolve=null,saving=false,saveFailed=false;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function dialog(html,handler){dialogHandler=handler;$('#dialog-content').innerHTML=html;$('#dialog').showModal();}
function closeDialog(result=false){$('#dialog').close();dialogHandler=null;if(confirmResolve){const resolve=confirmResolve;confirmResolve=null;resolve(result);}}
function confirm(title,text,button='Продолжить'){
  return new Promise(resolve=>{confirmResolve=resolve;dialog(`<h2>${escape(title)}</h2><p>${escape(text)}</p><div class="actions"><button class="button subtle" data-action="dialog-cancel">Отмена</button><button class="button primary" data-action="dialog-confirm">${escape(button)}</button></div>`);});
}
function error(message){toast(message);}
function persist(immediate=false){
  clearTimeout(saveTimeout);saving=true;const revision=++saveRevision;
  $('#save-status').textContent='Сохраняем…';$('#save-status').classList.remove('error');
  const write=async()=>{
    try{await GameStorage.save({version:1,pack:state.pack,game:state.game,history:state.history});if(revision!==saveRevision)return;saveFailed=false;$('#save-status').textContent='Сохранено на этом устройстве';$('#save-status').classList.remove('error');}
    catch(err){if(revision!==saveRevision)return;saveFailed=true;$('#save-status').textContent='Не сохранено — экспортируйте пакет';$('#save-status').classList.add('error');$('#save-status').title=err.message;}
    finally{if(revision===saveRevision)saving=false;}
  };
  if(immediate)return write();saveTimeout=setTimeout(write,300);
}
function stats(){return {themes:state.pack.rounds.reduce((n,r)=>n+r.themes.length,0),questions:state.pack.rounds.reduce((n,r)=>n+r.themes.reduce((a,t)=>a+t.questions.length,0),0)};}
function home(){
 const {questions}=stats();
 return `<section class="home-hero"><div class="home-copy"><div class="eyebrow"><span class="dot"></span>КЛАССИКА В ХОРОШЕЙ КОМПАНИИ</div><h1>Хороший вечер.<br><em>Большая игра.</em></h1><p>Соберите команды, выбирайте вопросы<br>и забирайте очки. Всё готово к вашему вечеру.</p><div class="actions"><button class="button primary" data-action="${state.game?'resume':'setup'}">${state.game?'Продолжить игру':'Начать игру'} <span>→</span></button><button class="button subtle" data-action="editor">Редактор пакета</button></div><span class="quiet-note">2–4 команды &nbsp;·&nbsp; 2 раунда и финал &nbsp;·&nbsp; Без интернета</span></div>
 <div class="preview" aria-hidden="true"><div class="preview-top"><span>СВОЯ ИГРА</span><span>РАУНД 01 / 02</span></div><div class="preview-grid">${['ВОКРУГ СВЕТА','МИР НАУКИ','КИНОСЕАНС','КНИГИ И ГЕРОИ'].map((t,i)=>`<span class="preview-theme">${t}</span><span>${i===2?'—':100}</span><span>300</span><span>500</span>`).join('')}</div><div class="preview-footer">ОДИН ВОПРОС МОЖЕТ ИЗМЕНИТЬ ВСЁ</div><div class="preview-star">✦</div></div></section>
 <section class="panel package-card"><div><span class="eyebrow">ТЕКУЩИЙ ПАКЕТ</span><h2>${escape(state.pack.title||'Без названия')}</h2><div class="stats"><span><b>02</b> раунда</span><span><b>${questions}</b> вопросов</span><span><b>${state.pack.finals.length}</b> финальные темы</span></div></div><div class="actions"><button class="button subtle" data-action="import">↑ Импорт пакета</button><button class="button subtle" data-action="export">↓ Экспорт</button></div></section>
 <div class="home-bottom"><div><span>СДЕЛАНО ДЛЯ ВАШЕЙ КОМПАНИИ</span><span>ЛОКАЛЬНО · БЕЗ РЕГИСТРАЦИИ</span></div><div class="actions">${state.game?'<button class="button compact subtle danger" data-action="discard">Сбросить партию</button>':''}<button class="button compact subtle" data-action="help">Как играть</button><button class="button compact subtle" data-action="demo">Демо-пакет</button></div></div>`;
}
function setup(){return `<section class="setup"><button class="button subtle compact" data-action="home">← Назад</button><div class="eyebrow" style="margin-top:30px">ПЕРЕД НАЧАЛОМ</div><h1>Кто сегодня играет?</h1><p class="muted">Пакет «${escape(state.pack.title)}». Сначала — названия команд.</p><div class="panel"><div class="small muted">Количество команд</div><div class="segmented">${[2,3,4].map(n=>`<button class="button ${n===state.teamCount?'selected':''}" data-action="team-count" data-count="${n}">${n} команды</button>`).join('')}</div><form id="setup-form"><div class="team-inputs">${state.names.slice(0,state.teamCount).map((name,i)=>`<label class="field">Команда ${i+1}<input name="team${i}" data-name-index="${i}" value="${escape(name)}" required maxlength="40" autocomplete="off"></label>`).join('')}</div><p class="help" style="margin-top:25px">Ведущий выбирает отвечающую команду и отмечает результат. Физические звонки и поднятые руки — на ваше усмотрение.</p><div id="setup-error" class="form-error" role="alert"></div><button class="button primary" style="margin-top:10px" type="submit">К игровому полю →</button></form></div></section>`;}
function roundTrack(){return `<div class="round-track"><span class="${state.game.round===0?'active':''}">01 &nbsp; ПЕРВЫЙ РАУНД</span><span>—</span><span class="${state.game.round===1&&['board','question','special'].includes(state.game.stage)?'active':''}">02 &nbsp; ВТОРОЙ РАУНД</span><span>—</span><span class="${state.game.final?'active':''}">ФИНАЛ</span></div>`;}
function scores(selectable=false){const g=state.game;return `<div class="scores" style="--teams:${g.teams.length}">${g.teams.map((t,i)=>{
 const selected=g.current?.team===i,graded=g.current?.graded.includes(i),disabled=selectable&&(g.current.resolved||graded||C.findQuestion(state.pack,g).type!=='normal');
 return `<${selectable?'button':'div'} class="score-card ${selectable&&selected?'selected':''} ${selectable&&graded?'graded':''}" ${selectable?`data-action="select-team" data-team="${i}" ${disabled?'disabled':''}`:''}><div><span class="team-index">КОМАНДА ${String(i+1).padStart(2,'0')}</span><span class="team-name">${escape(t.name)}</span></div><strong>${num(t.score)}</strong>${!selectable&&['board','special','eliminate'].includes(g.stage)?`<button class="edit-score" data-action="adjust" data-team="${i}" aria-label="Изменить счёт ${escape(t.name)}">✎ счёт</button>`:''}</${selectable?'button':'div'}>`;
 }).join('')}</div>`;}
function board(){
 const g=state.game,r=state.pack.rounds[g.round],total=r.themes.reduce((n,t)=>n+t.questions.length,0),used=r.themes.reduce((n,t)=>n+t.questions.filter(q=>g.used.includes(q.id)).length,0),cols=Math.max(...r.themes.map(t=>t.questions.length));
 return `<div class="page-heading board-heading"><div>${roundTrack()}<h1>${escape(state.pack.title)}</h1></div><div class="actions"><span class="tag">${used} / ${total} СЫГРАНО</span><button class="button subtle compact" data-action="undo" ${state.history.length?'':'disabled'}>↶ Отменить</button><button class="button subtle compact" data-action="home">В меню</button></div></div><div class="board-scroll"><div class="board" style="min-width:${cols>5?230+cols*90:0}px">${r.themes.map(t=>`<div class="board-row" style="--cols:${cols}"><div class="theme-cell">${escape(t.title)}</div>${t.questions.map(q=>`<button class="price-cell ${g.used.includes(q.id)?'used':''}" data-action="open-question" data-id="${escape(q.id)}" ${g.used.includes(q.id)?'disabled':''} aria-label="${escape(t.title)}, ${q.value}${g.used.includes(q.id)?', сыграно':''}">${g.used.includes(q.id)?'—':q.value}</button>`).join('')}${Array.from({length:cols-t.questions.length},()=>'<span class="price-cell empty"></span>').join('')}</div>`).join('')}</div></div><div class="board-footer"><span>${used===total?'Все вопросы сыграны. Пора двигаться дальше.':'Выберите тему и стоимость вопроса.'}</span><button class="button subtle compact" data-action="advance">${g.round===0?'Следующий раунд':'Перейти к финалу'} →</button></div>${scores()}`;
}
function media(items){return items.length?`<div class="media-grid">${items.map(m=>`<div class="media-item">${m.kind==='image'?`<img src="${m.data}" alt="Изображение к вопросу или ответу">`:m.kind==='audio'?`<audio controls preload="metadata" src="${m.data}"></audio>`:`<video controls playsinline preload="metadata" src="${m.data}"></video>`}</div>`).join('')}</div>`:'';}
function timerTarget(){return state.game?.stage==='question'?state.game.current:state.game?.stage==='finalQuestion'?state.game.final:null;}
function remaining(timer){return timer?.deadline?Math.max(0,(timer.deadline-Date.now())/1000):timer?.remaining||0;}
function clockText(seconds){const s=Math.ceil(seconds);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function timerUI(){const t=timerTarget().timer;return `<div class="timer"><span class="timer-number" id="timer-number" role="timer" aria-label="Осталось времени">${clockText(remaining(t))}</span><span class="timer-label" id="timer-label">${remaining(t)===0?'Время вышло':t.deadline?'Идёт отсчёт':'На размышление'}</span><button class="button compact subtle" data-action="timer-toggle">${t.deadline?'Ⅱ Пауза':'▷ Старт'}</button><button class="button compact subtle" data-action="timer-reset" aria-label="Сбросить таймер">↺</button></div>`;}
function questionScreen(final=false){
 const g=state.game,q=C.findQuestion(state.pack,g),c=final?g.final:g.current;
 const theme=final?q.title:state.pack.rounds[g.round].themes.find(t=>t.questions.some(x=>x.id===q.id)).title;
 const team=c.team===null?null:g.teams[c.team];
 return `<div class="stage-top"><div class="row"><span class="eyebrow">${final?'ФИНАЛ':escape(theme)}</span>${final?`<span class="tag">${escape(theme)}</span>`:`<span class="tag gold">${num(c.stake)} ОЧКОВ</span>`}</div><div class="actions"><button class="button compact subtle" data-action="undo" ${state.history.length?'':'disabled'}>↶ Отменить</button><button class="button compact subtle" data-action="home">В меню</button></div></div>
 <section class="panel question-stage"><div class="question-text">${escape(q.text)}</div>${media(q.media)}${c.revealed?`<div class="answer-box"><span class="eyebrow">ПРАВИЛЬНЫЙ ОТВЕТ</span><div class="question-text">${escape(q.answer)}</div>${media(q.answerMedia)}</div>`:''}</section>
 <div class="question-controls">${timerUI()}<div class="actions">${!c.revealed?'<button class="button primary" data-action="reveal">Показать ответ</button>':'<span class="tag">ОТВЕТ ОТКРЫТ</span>'}${!final?'<button class="button subtle" data-action="close-question">К табло →</button>':''}</div></div>
 ${final?finalVerdicts():`<div class="grade-toolbar"><p>${c.resolved?'Результат учтён. Можно вернуться к табло.':team?`Отвечает: <b>${escape(team.name)}</b>`:'Выберите отвечающую команду ниже.'}</p><div class="actions"><button class="button success" data-action="score-correct" ${!team||c.resolved||c.graded.includes(c.team)?'disabled':''}>✓ Верно · +${num(c.stake)}</button><button class="button danger" data-action="score-wrong" ${!team||c.resolved||c.graded.includes(c.team)?'disabled':''}>✕ Неверно · −${num(c.stake)}</button></div></div>${scores(true)}<p class="help" style="margin-top:14px"><span class="kbd">Пробел</span> таймер &nbsp; <span class="kbd">1–4</span> выбор команды &nbsp; <span class="kbd">О</span> ответ</p>`}`;
}
function special(){const g=state.game,q=C.findQuestion(state.pack,g),cat=q.type==='cat';return `<div class="stage-top"><span class="eyebrow">НЕОЖИДАННЫЙ ПОВОРОТ</span><button class="button subtle compact" data-action="undo">↶ Назад к табло</button></div><section class="special-stage"><div class="special-symbol">${cat?'◆':'↗'}</div><h1>${cat?'Кот в мешке':'Аукцион'}</h1><p class="muted">${cat?'Передайте вопрос другой команде и назначьте стоимость.':'Проведите торги вслух, затем укажите победителя и ставку.'}</p><form class="panel" id="special-form"><div class="field-row"><label class="field">${cat?'Команда-получатель':'Победитель торгов'}<select name="team" required><option value="">Выберите команду</option>${g.teams.map((t,i)=>`<option value="${i}">${escape(t.name)} · ${num(t.score)}</option>`).join('')}</select></label><label class="field">${cat?'Стоимость вопроса':'Итоговая ставка'}<input name="stake" type="number" min="${cat?1:q.value}" max="1000000" step="1" value="${q.value}" required></label></div><p class="help">${cat?'Стоимость определяет ведущий.':'Минимальная ставка — '+num(q.value)+'. Ставку определяет ведущий; она может превышать счёт команды.'}</p><div class="form-error" id="special-error" role="alert"></div><button class="button primary" type="submit" style="width:100%">Открыть вопрос →</button></form></section>${scores()}`;}
function eliminate(){const g=state.game,f=g.final,i=f.order[f.turn];return `<div class="page-heading"><div><div class="eyebrow">ФИНАЛ · ВЫБОР ТЕМЫ</div><h1 style="margin-top:12px">Останется только одна</h1><p>Исключает тему: <b class="gold">${escape(g.teams[i].name)}</b>. Нажмите на тему, которую убираете.</p></div><button class="button subtle compact" data-action="undo">↶ Отменить</button></div><div class="final-grid">${state.pack.finals.map(q=>`<button class="final-theme" data-action="eliminate" data-id="${escape(q.id)}" ${f.remaining.includes(q.id)?'':'disabled'}>${escape(q.title)}</button>`).join('')}</div><p class="help">Команды исключают темы по очереди, начиная с команды с наименьшим счётом.</p>${scores()}`;}
function bets(){const g=state.game,f=g.final,i=f.order[f.turn],t=g.teams[i],q=state.pack.finals.find(q=>q.id===f.remaining[0]);return `<section class="setup"><div class="eyebrow">ФИНАЛ · СТАВКИ</div><h1 style="margin-top:14px">${escape(q.title)}</h1><p class="muted">Ставку вводит: <b class="gold">${escape(t.name)}</b></p><div class="panel"><div class="bet-progress">${g.teams.map((_,j)=>`<span class="${j<f.turn?'done':''}"></span>`).join('')}</div><form id="bet-form"><label class="field">Ваша ставка · от 0 до ${num(Math.max(0,t.score))}<input name="amount" type="password" inputmode="numeric" pattern="[0-9]+" maxlength="10" required autocomplete="off" placeholder="Введите ставку"></label><p class="help">Введите ставки по очереди. На общем экране попросите другие команды отвернуться или передайте ведущему ставки на бумаге. Значения скрыты до показа ответа.</p><div id="bet-error" class="form-error" role="alert"></div><button class="button primary" type="submit">${f.turn===g.teams.length-1?'Открыть финальный вопрос':'Сохранить ставку и передать ход'} →</button></form></div><button class="button subtle compact" style="margin-top:20px" data-action="undo">↶ Назад</button></section>`;}
function finalVerdicts(){const g=state.game,f=g.final;return !f.revealed?'<p class="help">Команды записывают ответы на бумаге. После окончания времени покажите правильный ответ и отметьте результаты.</p>':`<div class="verdict-list" style="--teams:${g.teams.length}">${g.teams.map((t,i)=>`<div class="verdict-card"><h3>${escape(t.name)}</h3><p class="help">Ставка: <b class="gold">${num(f.bets[i])}</b></p><div class="actions"><button class="button compact success ${f.verdicts[i]===true?'selected':''}" data-action="verdict-yes" data-team="${i}">✓ Верно</button><button class="button compact danger ${f.verdicts[i]===false?'selected':''}" data-action="verdict-no" data-team="${i}">✕ Неверно</button></div></div>`).join('')}</div><div class="actions" style="justify-content:flex-end"><button class="button primary" data-action="finish" ${f.verdicts.every(v=>typeof v==='boolean')?'':'disabled'}>Подвести итоги →</button></div>`;}
function results(){const g=state.game,sorted=g.teams.map((t,i)=>({...t,index:i})).sort((a,b)=>b.score-a.score),winners=sorted.filter(t=>t.score===sorted[0].score);return `<section class="results"><div class="special-symbol">✦</div><div class="eyebrow">${winners.length===1?'ПОБЕДИТЕЛИ ЭТОГО ВЕЧЕРА':'ПЕРВОЕ МЕСТО РАЗДЕЛИЛИ'}</div><h1 style="margin-top:17px">${winners.map(t=>escape(t.name)).join(' · ')}</h1><p class="muted">Хорошая игра. Отличная компания.</p><div class="results-list">${sorted.map((t,i)=>`<div class="result-row ${t.score===sorted[0].score?'winner':''}"><span class="rank">${sorted.findIndex(x=>x.score===t.score)+1}</span><span class="result-name">${escape(t.name)}</span><strong>${num(t.score)}</strong></div>`).join('')}</div><div class="actions"><button class="button primary" data-action="new-game">Сыграть ещё раз →</button><button class="button subtle" data-action="home">Главное меню</button><button class="button subtle" data-action="undo">↶ Исправить итог</button></div></section>`;}
function render(){
 if(!state.pack)return;
 $('#app').innerHTML=state.view==='home'?home():state.view==='setup'?setup():state.view==='editor'?GameEditor.render():({board,special,question:()=>questionScreen(),eliminate,bets,finalQuestion:()=>questionScreen(true),results}[state.game.stage])();
 document.title=`${state.view==='editor'?'Редактор — ':''}Своя игра`;
 tick();
}
function act(type,data={},history=true){
 const previous=state.game,next=C.transition(state.pack,previous,{type,...data});
 if(history){state.history.push(C.clone(previous));if(state.history.length>40)state.history.shift();}
 state.game=next;persist();render();
}
function pauseTimer(){const target=timerTarget();if(target?.timer.deadline){const t=target.timer;state.game=C.transition(state.pack,state.game,{type:'timer',timer:{remaining:remaining(t),deadline:null}});persist();}}
function tick(){
 const target=timerTarget();if(!target)return;const t=target.timer,left=remaining(t);
 const number=$('#timer-number');if(number){number.textContent=clockText(left);number.classList.toggle('expired',left<=0);$('#timer-label').textContent=left<=0?'Время вышло':t.deadline?'Идёт отсчёт':'На размышление';}
 if(t.deadline&&left<=0){t.remaining=0;t.deadline=null;persist();if(state.view==='game'){toast('Время вышло');render();}}
}
async function download(){try{await GameMedia.download(C.validatePackage(state.pack));toast("Архив с JSON и папкой uploads отправлен в загрузки.");}catch(err){error(err.message);}}
async function allowReplace(){if(state.game){error('Сначала завершите или сбросьте текущую партию в главном меню.');return false;}return true;}
async function handle(action,el){
 if(action.startsWith('dialog-')){closeDialog(action==='dialog-confirm');return;}
 if(GameEditor.busy){toast('Дождитесь добавления файлов.');return;}
 if(action.startsWith('ed-')){await GameEditor.click(action,el);return;}
 switch(action){
 case 'home':pauseTimer();state.view='home';render();break;
 case 'resume':state.view='game';render();break;
 case 'setup':if(state.game){state.view='game';render();break;}C.validatePackage(state.pack,true);state.view='setup';render();break;
 case 'editor':if(await allowReplace()){state.view='editor';render();}break;
 case 'team-count':state.teamCount=Number(el.dataset.count);render();break;
 case 'open-question':act('open',{id:el.dataset.id});break;
 case 'select-team':act('select',{team:Number(el.dataset.team)});break;
 case 'score-correct':act('score',{correct:true});break;
 case 'score-wrong':act('score',{correct:false});break;
 case 'reveal':pauseTimer();act('reveal');break;
 case 'close-question':
   if(!state.game.current.resolved&&!await confirm('Завершить вопрос?', 'Вопрос станет сыгранным. Неначисленные очки останутся без изменений.','К табло'))return;
   act('close');break;
 case 'undo':{
   if(!state.history.length)return;
   state.game=state.history.pop();const t=timerTarget();if(t?.timer.deadline){t.timer.remaining=remaining(t.timer);t.timer.deadline=null;}state.view='game';persist();render();break;
 }
 case 'advance':{
   const r=state.pack.rounds[state.game.round],left=r.themes.flatMap(t=>t.questions).filter(q=>!state.game.used.includes(q.id)).length;
   if(!await confirm(state.game.round===0?'Перейти во второй раунд?':'Начать финал?',left?`На табло осталось вопросов: ${left}. Они будут пропущены.`:'Все вопросы раунда сыграны.','Перейти'))return;
   act('advance');break;
 }
 case 'adjust':{
   const i=Number(el.dataset.team),t=state.game.teams[i];
   dialog(`<h2>Счёт команды</h2><p>${escape(t.name)}</p><form id="dialog-form"><label class="field">Новое значение<input name="score" type="number" step="1" min="-1000000000" max="1000000000" value="${t.score}" required></label><div class="form-error" id="dialog-error" role="alert"></div><div class="actions"><button class="button subtle" type="button" data-action="dialog-cancel">Отмена</button><button class="button primary" type="submit">Сохранить</button></div></form>`,form=>{act('adjust',{team:i,score:Number(new FormData(form).get('score'))});closeDialog();});break;
 }
 case 'timer-toggle':{const t=timerTarget().timer,left=remaining(t);if(t.deadline)act('timer',{timer:{remaining:left,deadline:null}},false);else if(left>0)act('timer',{timer:{remaining:left,deadline:Date.now()+left*1000}},false);else toast('Сбросьте таймер, чтобы запустить его снова.');break;}
 case 'timer-reset':act('timer',{timer:{remaining:C.findQuestion(state.pack,state.game).seconds,deadline:null}},false);break;
 case 'eliminate':if(await confirm('Исключить тему?',state.pack.finals.find(q=>q.id===el.dataset.id).title,'Исключить'))act('eliminate',{id:el.dataset.id});break;
 case 'verdict-yes':act('verdict',{team:Number(el.dataset.team),correct:true});break;
 case 'verdict-no':act('verdict',{team:Number(el.dataset.team),correct:false});break;
 case 'finish':act('finish');break;
 case 'discard':case 'new-game':
   if(await confirm(action==='new-game'?'Начать новую партию?':'Сбросить партию?','Текущий счёт и прогресс будут удалены. Пакет вопросов сохранится.','Продолжить')){state.game=null;state.history=[];state.view=action==='new-game'?'setup':'home';persist();render();}break;
 case 'export':await download();break;
 case 'import':if(await allowReplace())$('#import-file').click();break;
 case 'demo':if(await allowReplace()&&await confirm('Загрузить демо-пакет?','Текущий пакет будет заменён. Если он нужен, сначала экспортируйте его.','Загрузить')){state.pack=createDemoPackage();GameEditor.reset();persist();render();}break;
 case 'fullscreen':
   try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Используйте полноэкранный режим браузера: Control + Command + F.');}catch{toast('Используйте полноэкранный режим браузера: Control + Command + F.');}break;
 case 'help':dialog('<h2>Вечер начинается с вопроса</h2><p>1. Создайте 2–4 команды и выберите вопрос на табло.\n2. Выберите отвечающую команду, запустите таймер при необходимости.\n3. Отметьте правильный или неправильный ответ. После ошибки может ответить другая команда.\n4. Покажите ответ и вернитесь к табло.\n5. После двух раундов — исключение финальных тем, ставки и решающий вопрос.</p><p>Редактор позволяет создавать свои темы и прикреплять файлы. Экспорт пакета — ваша резервная копия. Для ТВ включите дублирование экрана Mac и полноэкранный режим браузера.</p><div class="actions"><button class="button primary" data-action="dialog-cancel">Всё понятно</button></div>');break;
 }
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;handle(el.dataset.action,el).catch(err=>error(err.message));});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.dataset.nameIndex!==undefined)state.names[Number(el.dataset.nameIndex)]=el.value;
 if(state.view==='editor'&&el.dataset.ed)GameEditor.input(el);
});
document.addEventListener('change',async event=>{
 const el=event.target;
 try{
  if(el.matches('.media-upload'))await GameEditor.upload(el);
  else if(el.id==='import-file'){
   const file=el.files[0];el.value='';if(!file)return;
   if(file.size>145*1024*1024)throw new Error('Пакет слишком большой. Максимум 145 МБ в формате JSON.');
   let p;try{p=JSON.parse(await file.text());}catch{throw new Error('Не удалось прочитать JSON. Выберите файл, экспортированный из этой игры.');}
   const validated=C.validatePackage(p);
   if(state.game)throw new Error('Нельзя заменить пакет во время партии.');
   if(await confirm('Импортировать пакет?',`«${validated.title}» заменит текущий пакет. Неэкспортированные изменения будут потеряны.`,'Импортировать')){state.pack=await GameMedia.prepare(validated);GameEditor.reset();persist();render();toast('Пакет импортирован.');}
  }else if(state.view==='editor'&&el.dataset.ed&&!['text','answer'].includes(el.dataset.ed))render();
 }catch(err){error(err.message);}
});
document.addEventListener('submit',event=>{
 event.preventDefault();const form=event.target,fd=new FormData(form);
 try{
  if(form.id==='setup-form'){state.game=C.createGame(state.pack,state.names.slice(0,state.teamCount));state.history=[];state.view='game';persist();render();}
  else if(form.id==='special-form')act('assign',{team:Number(fd.get('team')),stake:Number(fd.get('stake'))});
  else if(form.id==='bet-form')act('bet',{amount:Number(fd.get('amount'))});
  else if(form.id==='dialog-form'&&dialogHandler)dialogHandler(form);
 }catch(err){const target=form.querySelector('.form-error');if(target)target.textContent=err.message;else error(err.message);}
});
$('#dialog').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
document.addEventListener('keydown',event=>{
 if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||$('#dialog').open||/INPUT|TEXTAREA|SELECT|BUTTON|AUDIO|VIDEO/.test(event.target.tagName)||state.view!=='game')return;
 const stage=state.game.stage;
 if(!['question','finalQuestion'].includes(stage))return;
 let action;if(event.code==='Space')action='timer-toggle';else if(['KeyO','KeyA'].includes(event.code))action='reveal';
 else if(stage==='question'&&/^[1-4]$/.test(event.key)&&C.findQuestion(state.pack,state.game).type==='normal'){event.preventDefault();try{act('select',{team:Number(event.key)-1});}catch(err){error(err.message);}return;}
 if(action){event.preventDefault();handle(action,{}).catch(err=>error(err.message));}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-button').textContent=document.fullscreenElement?'⛶ Выйти из полного экрана':'⛶ На весь экран';});
window.addEventListener('beforeunload',event=>{if(saving||saveFailed||GameEditor.busy){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&saving)persist(true);});
root.App={state,escape,render,persist,toast,confirm};
async function init(){
 try{
  const saved=await GameStorage.open();
  if(saved?.pack){state.pack=location.protocol==='file:'?C.validatePackage(saved.pack):await GameMedia.prepare(C.validatePackage(saved.pack));if(saved.game){
    const g=saved.game;
    if(!['board','question','special','eliminate','bets','finalQuestion','results'].includes(g.stage)||!Array.isArray(g.teams)||g.teams.length<2||g.teams.length>4)throw new Error('Повреждено сохранение партии.');
    state.game=g;state.history=Array.isArray(saved.history)?saved.history.slice(-40):[];
  }}else state.pack=createDemoPackage();
 }catch(err){state.pack=state.pack||createDemoPackage();state.game=null;state.history=[];toast('Сохранение не удалось восстановить: '+err.message);}
 render();await persist(true);
 setInterval(tick,200);
}
init();
})(globalThis);
