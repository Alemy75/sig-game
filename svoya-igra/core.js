/* Pure game rules. Shared by the browser and the dependency-free Node tests. */
(function (root) {
  'use strict';
  const MAX_SCORE = 1000000000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
  const integer = (n, min, max = MAX_SCORE) => Number.isSafeInteger(n) && n >= min && n <= max;
  function validatePackage(input, playable = false) {
    requireThat(input && input.version === 1, 'Неподдерживаемый формат пакета. Нужен пакет версии 1.');
    const ids = new Set();
    let mediaSize = 0;
    const str = (v, max = 10000) => { requireThat(typeof v === 'string' && v.length <= max, 'Некорректное или слишком длинное текстовое поле.'); return v; };
    const id = v => { str(v, 100); requireThat(v.length && !ids.has(v), 'Идентификаторы элементов должны быть уникальными.'); ids.add(v); return v; };
    const list = (v, min, max, name) => { requireThat(Array.isArray(v) && v.length >= min && v.length <= max, `${name}: допустимо от ${min} до ${max} элементов.`); return v; };
    const media = value => list(value || [], 0, 8, 'Медиа').map(m => {
      requireThat(m && ['image','audio','video'].includes(m.kind), 'Неизвестный тип медиа.');
      if (typeof m.data === 'string' && /^uploads\/[a-f0-9]{64}\.(png|jpg|gif|webp|mp3|wav|ogg|m4a|aac|webm|mp4|mov)$/.test(m.data)) {
        return {kind:m.kind, name:str(m.name || 'Медиа', 255), data:m.data};
      }
      requireThat(typeof m.data === 'string' && m.data.length <= 42 * 1024 * 1024, 'Файл слишком большой. Максимум 30 МБ.');
      const match = /^data:(image\/(?:png|jpeg|gif|webp)|audio\/(?:mpeg|mp3|wav|x-wav|ogg|mp4|aac|webm)|video\/(?:mp4|webm|ogg|quicktime));base64,([A-Za-z0-9+/]*={0,2})$/.exec(m.data);
      requireThat(match && match[1].split('/')[0] === m.kind, 'Медиа должны быть встроенными PNG/JPEG/GIF/WebP, аудио или видео. Внешние ссылки и SVG не поддерживаются.');
      mediaSize += m.data.length;
      requireThat(mediaSize <= 140 * 1024 * 1024, 'Общий размер медиа превышает 100 МБ.');
      return {kind:m.kind, name:str(m.name || 'Медиа', 255), data:m.data};
    });
    function question(q, final = false) {
      requireThat(q && typeof q === 'object', 'Повреждённый вопрос.');
      requireThat(integer(q.seconds, 1, 3600), 'Таймер должен быть от 1 до 3600 секунд.');
      const normalized = {id:id(q.id), text:str(q.text), answer:str(q.answer), seconds:q.seconds, media:media(q.media), answerMedia:media(q.answerMedia)};
      if (final) normalized.title = str(q.title, 150);
      else {
        requireThat(['normal','cat','auction'].includes(q.type), 'Неизвестный тип вопроса.');
        requireThat(integer(q.value, 1, 1000000), 'Стоимость должна быть целым числом от 1 до 1 000 000.');
        Object.assign(normalized, {type:q.type, value:q.value});
      }
      if (playable) {
        requireThat(normalized.text.trim() || normalized.media.length, 'В пакете есть вопрос без текста и медиа.');
        requireThat(normalized.answer.trim() || normalized.answerMedia.length, 'В пакете есть вопрос без ответа. Заполните его в редакторе.');
        if (final) requireThat(normalized.title.trim(), 'Введите название финальной темы.');
      }
      return normalized;
    }
    const pack = {version:1, title:str(input.title, 150), rounds:list(input.rounds, 2, 2, 'Основные раунды').map(r => ({
      name:str(r.name, 150), themes:list(r.themes, 1, 20, 'Темы').map(t => ({id:id(t.id), title:str(t.title, 150), questions:list(t.questions, 1, 20, 'Вопросы').map(q=>question(q))}))
    })), finals:list(input.finals, 1, 20, 'Финальные темы').map(q=>question(q,true))};
    if (playable) {
      requireThat(pack.title.trim(), 'Введите название пакета.');
      requireThat(pack.rounds.every(r=>r.themes.every(t=>t.title.trim())), 'Введите названия всех тем.');
    }
    return pack;
  }
  function createGame(pack, names) {
    validatePackage(pack, true);
    requireThat(Array.isArray(names) && names.length >= 2 && names.length <= 4, 'Выберите от 2 до 4 команд.');
    const clean = names.map(n => typeof n === 'string' ? n.trim() : '');
    requireThat(clean.every(n => n && n.length <= 40) && new Set(clean.map(n=>n.toLocaleLowerCase('ru'))).size === clean.length, 'Названия команд должны быть непустыми, разными и не длиннее 40 символов.');
    return {stage:'board', round:0, teams:clean.map(name=>({name,score:0})), used:[], current:null, final:null};
  }
  function findQuestion(pack, game) {
    if (game.stage === 'finalQuestion' || game.stage === 'results') return pack.finals.find(q=>q.id === game.final.remaining[0]);
    return pack.rounds[game.round].themes.flatMap(t=>t.questions).find(q=>q.id === game.current?.id);
  }
  function transition(pack, previous, action) {
    const g = clone(previous);
    const team = index => { requireThat(integer(index, 0, g.teams.length-1), 'Выберите команду.'); return g.teams[index]; };
    const stage = (...allowed) => requireThat(allowed.includes(g.stage), 'Это действие недоступно на текущем этапе.');
    const applyScore = (index, value) => { const t=team(index); requireThat(integer(t.score+value,-MAX_SCORE), 'Счёт выходит за допустимые пределы.'); t.score+=value; };
    switch (action.type) {
      case 'open': {
        stage('board');
        const q=pack.rounds[g.round].themes.flatMap(t=>t.questions).find(q=>q.id===action.id);
        requireThat(q && !g.used.includes(q.id), 'Вопрос недоступен.');
        g.current={id:q.id,team:null,stake:q.value,graded:[],revealed:false,resolved:false,timer:{remaining:q.seconds,deadline:null}};
        g.stage=q.type==='normal' ? 'question' : 'special'; break;
      }
      case 'assign': {
        stage('special'); team(action.team);
        const q=findQuestion(pack,g);
        requireThat(integer(action.stake,q.type==='auction'?q.value:1,1000000), `Ставка: целое число от ${q.type==='auction'?q.value:1} до 1 000 000.`);
        Object.assign(g.current,{team:action.team,stake:action.stake}); g.stage='question'; break;
      }
      case 'select':
        stage('question'); team(action.team);
        requireThat(findQuestion(pack,g).type==='normal', 'В специальном вопросе отвечает назначенная команда.');
        requireThat(!g.current.resolved && !g.current.graded.includes(action.team), 'Эта команда уже отвечала или вопрос завершён.');
        g.current.team=action.team; break;
      case 'reveal':
        stage('question','finalQuestion'); (g.stage==='question'?g.current:g.final).revealed=true; break;
      case 'score': {
        stage('question'); const c=g.current; team(c.team);
        requireThat(typeof action.correct==='boolean' && !c.resolved && !c.graded.includes(c.team), 'Результат уже учтён.');
        applyScore(c.team,action.correct?c.stake:-c.stake); c.graded.push(c.team);
        c.resolved=action.correct || findQuestion(pack,g).type!=='normal' || c.graded.length===g.teams.length;
        if (action.correct) c.revealed=true;
        if (c.resolved && c.timer.deadline) {
          c.timer.remaining=Math.max(0,(c.timer.deadline-Date.now())/1000);
          c.timer.deadline=null;
        }
        break;
      }
      case 'close':
        stage('question'); g.used.push(g.current.id); g.current=null; g.stage='board'; break;
      case 'adjust':
        requireThat(g.stage!=='results' && !['bets','finalQuestion'].includes(g.stage), 'Счёт нельзя менять после начала ставок финала.');
        requireThat(integer(action.score,-MAX_SCORE), 'Счёт должен быть целым числом в пределах ±1 000 000 000.');
        team(action.team).score=action.score; break;
      case 'advance':
        stage('board');
        if (g.round===0) { g.round=1; }
        else {
          const order=g.teams.map((_,i)=>i).sort((a,b)=>g.teams[a].score-g.teams[b].score || a-b);
          g.final={remaining:pack.finals.map(q=>q.id),order,turn:0,bets:g.teams.map(()=>null),verdicts:g.teams.map(()=>null),revealed:false,timer:null};
          g.stage=pack.finals.length>1?'eliminate':'bets';
        } break;
      case 'eliminate':
        stage('eliminate'); requireThat(g.final.remaining.includes(action.id),'Тема уже исключена.');
        g.final.remaining=g.final.remaining.filter(id=>id!==action.id); g.final.turn=(g.final.turn+1)%g.teams.length;
        if(g.final.remaining.length===1) {g.stage='bets';g.final.turn=0;} break;
      case 'bet': {
        stage('bets'); const i=g.final.order[g.final.turn];
        requireThat(integer(action.amount,0,Math.max(0,g.teams[i].score)), 'Ставка должна быть целой, неотрицательной и не превышать счёт команды.');
        g.final.bets[i]=action.amount;g.final.turn++;
        if(g.final.turn===g.teams.length) {g.stage='finalQuestion';g.final.timer={remaining:findQuestion(pack,g).seconds,deadline:null};} break;
      }
      case 'verdict':
        stage('finalQuestion');team(action.team); requireThat(g.final.revealed && typeof action.correct==='boolean','Сначала покажите ответ.');
        g.final.verdicts[action.team]=action.correct; break;
      case 'finish':
        stage('finalQuestion');requireThat(g.final.verdicts.every(v=>typeof v==='boolean'),'Оцените ответы всех команд.');
        g.teams.forEach((_,i)=>applyScore(i,g.final.bets[i]*(g.final.verdicts[i]?1:-1)));g.stage='results';g.final.timer.deadline=null; break;
      case 'timer': {
        stage('question','finalQuestion'); const target=g.stage==='question'?g.current:g.final;
        requireThat(action.timer && Number.isFinite(action.timer.remaining) && action.timer.remaining>=0 && action.timer.remaining<=3600 && (action.timer.deadline===null || Number.isFinite(action.timer.deadline)), 'Некорректный таймер.');
        target.timer=clone(action.timer);break;
      }
      default: throw new Error('Неизвестное действие.');
    }
    return g;
  }
  const api={validatePackage,createGame,transition,findQuestion,clone};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.GameCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
