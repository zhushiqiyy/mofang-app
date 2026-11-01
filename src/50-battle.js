/* =========================================================================
   50-battle.js — 实战练习 + 人机对战
   ========================================================================= */

let pracCube = solvedCube();
let pracScrambleToks = [];
let pracMoves = 0;
let pracRunning = false;
let pracStart = 0;
let pracTimer = null;
let pracBusy = false;
const pracQueue = [];

const DIFFS = [
  { key:'easy', name:'新手', em:'🐣', ms:46000, steps:60, tip:'慢悠悠，刚学会也能赢' },
  { key:'mid',  name:'高手', em:'🐯', ms:27000, steps:56, tip:'要认真拧才追得上' },
  { key:'hard', name:'大师', em:'👑', ms:15000, steps:50, tip:'接近高手的水平' }
];
let battleDiff = 'easy';
let battle = { active:false, aiT0:0, aiTimer:null, playerWon:false, aiDone:false, aiSteps:0 };

/* ---------------- 实战练习 ---------------- */
let pracInited = false;

function renderPractice(){
  const cv = cubeView($('prac-3d'));
  drawCube($('prac-3d'), pracCube, {});
  mountViewCtrl($('prac-viewctrl'), () => $('prac-3d'));

  if (!pracInited){
    pracInited = true;

    /* 手动拧按钮 */
    const host = $('prac-btns');
    host.innerHTML = '';
    ['U','R','F','L','D','B'].forEach(f => {
      const line = el('div');
      line.style.cssText = 'display:flex;gap:6px;align-items:center;margin:6px 0;';
      line.appendChild(el('div','pill', FACE_NAME[f] + ' ' + f));
      line.querySelector('.pill').style.minWidth = '56px';
      line.querySelector('.pill').style.textAlign = 'center';
      [['',f],["'",f+"'"],['2',f+'2']].forEach(([sfx,lb]) => {
        const b = el('button','btn alt sm', lb);
        b.style.cssText = 'min-width:52px;font-family:ui-monospace,Menlo,monospace;font-size:15px;';
        b.onclick = () => pracDo(lb);
        line.appendChild(b);
      });
      host.appendChild(line);
    });

    /* 难度选择 */
    const dsel = $('diff-sel');
    dsel.innerHTML = '';
    DIFFS.forEach(d => {
      const c = el('div','diff' + (battleDiff === d.key ? ' on' : ''));
      c.innerHTML = `<b>${d.em} ${d.name}</b><span>${d.tip}</span>`;
      c.onclick = () => {
        battleDiff = d.key;
        dsel.querySelectorAll('.diff').forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        $('bt-aiwho').textContent = d.em + ' ' + d.name;
      };
      dsel.appendChild(c);
    });

    document.addEventListener('keydown', e => {
      if (currentPage !== 'practice') return;
      if (e.key === ' '){ e.preventDefault(); pracScramble(); return; }
      const k = e.key.toUpperCase();
      if ('URFLDB'.indexOf(k) < 0) return;
      e.preventDefault();
      pracDo(k + (e.shiftKey ? "'" : ''));
    });

    refreshBattleRecord();
  }

  refreshPracUI();
  renderPracLog();

  /* 进阶路线 + 玩伴（练习模块重点：从零到完全掌握） */
  if (typeof renderRoadmap === 'function') renderRoadmap($('roadmap-host'));
  if (typeof renderCompanion === 'function') renderCompanion($('practice-companion'));
}

function refreshPracUI(){
  $('prac-time').textContent = ((pracRunning ? (performance.now() - pracStart) : 0) / 1000).toFixed(1);
  $('prac-stepspill').textContent = pracMoves + ' 步';
  $('prac-state').textContent = pracRunning ? '计时中…' : (isSolved(pracCube) ? '已复原' : '待打乱');
}

function pracDo(label){
  /* label 形如 "R" / "R'" / "R2" */
  const f = label[0];
  const prime = label.indexOf("'") > 0;
  const dbl = label.indexOf('2') > 0;
  pracQueue.push({ f, prime, dbl });
  if (!pracBusy) pracFlush();
}

function pracFlush(){
  if (!pracQueue.length){ pracBusy = false; return; }
  pracBusy = true;
  const t = pracQueue.shift();
  const tok = { f:t.f, prime:t.prime, dbl:t.dbl };

  animateAlg($('prac-3d'), pracCube, [tok], {
    speed: 3,
    onDone: cube => {
      pracCube = cube;
      pracMoves++;
      if (battle.active && !pracRunning) startPracTimer();
      drawCube($('prac-3d'), pracCube, {});
      refreshPracUI();
      pracFlush();

      /* 对战判定 */
      if (battle.active && !battle.playerWon && isSolved(pracCube)) battlePlayerWin();
      /* 普通挑战判定 */
      if (!battle.active && pracRunning && isSolved(pracCube)) pracStop(true);
    }
  });
}

function startPracTimer(){
  pracRunning = true;
  pracStart = performance.now();
  clearInterval(pracTimer);
  pracTimer = setInterval(() => {
    if (!pracRunning) return;
    $('prac-time').textContent = ((performance.now() - pracStart)/1000).toFixed(1);
  }, 80);
}

function pracReset(){
  pracStop(false);
  pracQueue.length = 0;
  pracCube = solvedCube();
  pracMoves = 0;
  pracScrambleToks = [];
  drawCube($('prac-3d'), pracCube, {});
  refreshPracUI();
  $('prac-time').textContent = '0.0';
  toast('已复原');
}

function pracStop(win){
  clearInterval(pracTimer);
  pracTimer = null;
  if (!pracRunning) return;
  pracRunning = false;
  const secs = (performance.now() - pracStart) / 1000;
  $('prac-time').textContent = secs.toFixed(1);
  if (win){
    pushLog('实战复原 ' + secs.toFixed(1) + ' 秒 / ' + pracMoves + ' 步');
    toast('🎉 ' + secs.toFixed(1) + ' 秒复原！用了 ' + pracMoves + ' 步');
  }
}

function pracScramble(){
  if (battle.active) battleQuit();
  pracStop(false);
  pracQueue.length = 0;
  const scr = randomScramble(20);
  pracScrambleToks = scr;
  let c = solvedCube();
  scr.forEach(t => { c = applyMove(c, moveOf(t)); });

  pracCube = c;
  pracMoves = 0;
  pracRunning = false;
  clearInterval(pracTimer);
  $('prac-time').textContent = '0.0';
  drawCube($('prac-3d'), pracCube, {});
  refreshPracUI();
  $('prac-state').textContent = '已打乱，开始拧';
  toast('打乱了！拧一步就开始计时');
}

/* ---------------- 人机对战 ---------------- */
function refreshBattleRecord(){
  $('bt-record').textContent = store.battle.w + ' 胜 / ' + store.battle.l + ' 负';
}

function battleStart(){
  if (battle.active) return;

  /* 一起打乱 */
  pracReset();
  const scr = randomScramble(20);
  pracScrambleToks = scr;
  let c = solvedCube();
  scr.forEach(t => { c = applyMove(c, moveOf(t)); });
  pracCube = c;
  pracMoves = 0;
  drawCube($('prac-3d'), pracCube, {});

  const d = DIFFS.find(x => x.key === battleDiff);

  battle = {
    active:true, aiT0: performance.now(), aiTimer:null,
    playerWon:false, aiDone:false, aiSteps:0, diff:d
  };

  $('bt-start').textContent = '比赛中…';
  $('bt-start').disabled = true;
  $('bt-msg').textContent = '🔔 开始！你拧第一步就计时，电脑也同时在拧。';
  $('bt-my').textContent = '0.0';
  $('bt-ai').textContent = '0.0';
  $('bt-mymv').textContent = '0 步';
  $('bt-aimv').textContent = '0 步';
  $('bt-aiwho').textContent = d.em + ' ' + d.name;

  $('prac-state').textContent = '对战进行中';

  battle.aiTimer = setInterval(() => {
    if (!battle.active) return;
    const el = performance.now() - battle.aiT0;
    const prog = Math.min(1, el / battle.diff.ms);
    $('bt-ai').textContent = (el/1000).toFixed(1);
    battle.aiSteps = Math.floor(prog * battle.diff.steps);
    $('bt-aimv').textContent = battle.aiSteps + ' 步';
    if (prog >= 1 && !battle.aiDone){
      battle.aiDone = true;
      battleAiWin();
    }
  }, 100);

  /* 玩家侧时间显示 */
  const myTick = setInterval(() => {
    if (!battle.active){ clearInterval(myTick); return; }
    if (pracRunning) $('bt-my').textContent = ((performance.now() - pracStart)/1000).toFixed(1);
    $('bt-mymv').textContent = pracMoves + ' 步';
  }, 100);
}

function battlePlayerWin(){
  if (!battle.active || battle.playerWon) return;
  battle.playerWon = true;
  clearInterval(battle.aiTimer);
  battle.active = false;
  const secs = (performance.now() - pracStart) / 1000;
  pracRunning = false;
  clearInterval(pracTimer);

  store.battle.w++;
  saveStore();
  pushLog('战胜 ' + battle.diff.name + '（' + secs.toFixed(1) + 's / ' + pracMoves + ' 步）');
  refreshBattleRecord();

  $('bt-msg').innerHTML = '🏆 <b>你赢了！</b>用时 ' + secs.toFixed(1) + ' 秒，' + pracMoves + ' 步。电脑才走到 ' + battle.aiSteps + ' 步。';
  $('bt-start').textContent = '⚔️ 再打一场';
  $('bt-start').disabled = false;
  $('bt-my').textContent = secs.toFixed(1);
  toast('🏆 赢了！');
}

function battleAiWin(){
  if (!battle.active) return;
  battle.active = false;
  clearInterval(battle.aiTimer);
  store.battle.l++;
  saveStore();
  pushLog('输给 ' + battle.diff.name);
  refreshBattleRecord();

  $('bt-msg').innerHTML = '🤖 <b>电脑先完成了。</b>别灰心 —— 你还有 ' +
    solvedCubies(pracCube) + ' / 26 块已经归位，再练几次就追上了。';
  $('bt-start').textContent = '⚔️ 再打一场';
  $('bt-start').disabled = false;
  $('bt-ai').textContent = (battle.diff.ms/1000).toFixed(1);
  toast('电脑赢了，再来一次！');
}

function battleQuit(){
  if (!battle.active){
    $('bt-msg').textContent = '准备好了就开打！';
    $('bt-start').textContent = '⚔️ 开始比赛';
    $('bt-start').disabled = false;
    return;
  }
  battle.active = false;
  clearInterval(battle.aiTimer);
  pracRunning = false;
  clearInterval(pracTimer);
  $('bt-msg').textContent = '已结束。';
  $('bt-start').textContent = '⚔️ 开始比赛';
  $('bt-start').disabled = false;
  $('prac-state').textContent = '对战已结束';
}

function renderPracLog(){
  const host = $('prac-log');
  host.innerHTML = '';
  const items = store.log.slice(0, 12);
  if (!items.length){ host.innerHTML = '<div><span>还没有记录</span></div>'; return; }
  items.forEach(x => {
    const d = el('div');
    const dt = new Date(x.t);
    d.innerHTML = '<span>' + x.txt + '</span><span class="sub">' +
      (dt.getMonth()+1) + '/' + dt.getDate() + '</span>';
    host.appendChild(d);
  });
}
