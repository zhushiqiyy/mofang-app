/* =========================================================================
   40-quest.js — 闯关之路：森林 → 山顶 → 城堡
   每关按公式学习顺序组合；按用时 + 正确率评 1~3 星。线性解锁。
   ========================================================================= */

const QUEST_STAGES = [
  { key:'forest', name:'森林', em:'🌲', cls:'stage-1',
    desc:'F2L 前两层 · 先把"角+棱配对"练成直觉', total:41 },
  { key:'mountain', name:'山顶', em:'⛰️', cls:'stage-2',
    desc:'OLL 顶层翻黄 · 一看到形状就知道用哪招', total:57 },
  { key:'castle', name:'城堡', em:'🏰', cls:'stage-3',
    desc:'PLL 顶层摆位 · 找车灯、认位置', total:21 }
];

/* 生成关卡（按公式编号顺序切片） */
function buildQuestLevels(){
  const out = [];

  function slice(arr, per, stageKey, stageEm){
    const n = Math.ceil(arr.length / per);
    for (let i=0;i<n;i++){
      const items = arr.slice(i*per, (i+1)*per);
      out.push({
        stageKey, no: i+1,
        name: stageEm + ' 第 ' + (i+1) + ' 关',
        items,
        nums: items.map(x => x.num)
      });
    }
  }

  slice(DATA.F2L, 4, 'forest', '🌲');    /* 41 → 11 关 */
  slice(DATA.OLL, 5, 'mountain', '⛰️');  /* 57 → 12 关 */
  slice(DATA.PLL, 3, 'castle', '🏰');    /* 21 → 7 关 */

  out.forEach((lv, i) => { lv.gid = i; lv.id = lv.stageKey + '-' + lv.no; });
  return out;
}

let ALL_LEVELS = buildQuestLevels();

function questKey(id){ return 'q_' + id; }
function questStars(id){ const r = store.quest[questKey(id)]; return r ? (r.stars||0) : 0; }
function questBest(id){ const r = store.quest[questKey(id)]; return r ? (r.best||0) : 0; }

function levelUnlocked(lv){
  if (lv.gid === 0) return true;
  const prev = ALL_LEVELS[lv.gid - 1];
  return questStars(prev.id) >= 1;
}

function renderQuest(){
  const done = ALL_LEVELS.filter(l => questStars(l.id) >= 1).length;
  const stars = ALL_LEVELS.reduce((a,l) => a + questStars(l.id), 0);

  $('quest-prog').textContent = done + ' / ' + ALL_LEVELS.length + ' 关';
  $('quest-bar').style.width = (done / ALL_LEVELS.length * 100) + '%';
  $('quest-stars').textContent = stars + ' / ' + (ALL_LEVELS.length * 3);

  const host = $('quest-stages');
  host.innerHTML = '';

  QUEST_STAGES.forEach((st, si) => {
    const levels = ALL_LEVELS.filter(l => l.stageKey === st.key);
    const sdone = levels.filter(l => questStars(l.id) >= 1).length;

    const box = el('div','stage ' + st.cls);
    const head = el('div','stage-head');
    head.innerHTML = `<span class="em">${st.em}</span>
      <div style="flex:1">
        <div class="nm">${st.name}（${sdone}/${levels.length}）</div>
        <div style="font-size:12.5px;opacity:.92">${st.desc}</div>
      </div>
      <span class="pg">${levels.reduce((a,l)=>a+questStars(l.id),0)} ⭐</span>`;
    box.appendChild(head);

    const grid = el('div','levels');
    levels.forEach(lv => {
      const unlocked = levelUnlocked(lv);
      const s = questStars(lv.id);
      const card = el('div','lv' + (unlocked ? '' : ' locked') + (unlocked && s === 0 && isCurrentLevel(lv) ? ' cur' : ''));
      card.innerHTML = `
        ${unlocked ? '' : '<span class="lockicon">🔒</span>'}
        <div class="n" style="font-size:15px">第 ${lv.no} 关</div>
        <div class="nm2">${lv.items.length} 招</div>
        <div class="st">${s ? '★'.repeat(s) + '<span style="opacity:.25">' + '★'.repeat(3-s) + '</span>' : (unlocked ? '还没打' : '先过前一关')}</div>`;
      if (unlocked) card.onclick = () => questIntro(lv);
      grid.appendChild(card);
    });
    box.appendChild(grid);
    host.appendChild(box);
  });
}

function isCurrentLevel(lv){
  if (!levelUnlocked(lv)) return false;
  if (lv.gid === 0) return questStars(lv.id) === 0;
  return questStars(ALL_LEVELS[lv.gid - 1].id) >= 1 && questStars(lv.id) === 0;
}

/* ---------------- 关卡流程 ---------------- */
let qState = null;

function questIntro(lv){
  const s = questStars(lv.id);
  const best = questBest(lv.id);
  const names = lv.items.map(it => lv.stageKey === 'castle' ? it.name : ('第' + it.num + '式 ' + shortName(lv.stageKey === 'forest' ? 'F2L' : 'OLL', it)));

  $('sheet').innerHTML = `
    <div class="sheet-head">
      <h3>${lv.name}</h3>
      <button class="closex" onclick="closeModal()">✕</button>
    </div>
    <div class="card" style="margin-top:6px;background:#f8fbff;">
      <div class="sub" style="margin-bottom:6px;">本关招数（按学习顺序）</div>
      <div class="row" style="gap:6px;">
        ${names.map(n => '<span class="pill p" style="font-size:12px">' + n + '</span>').join('')}
      </div>
    </div>
    <div class="talk">
      <div class="t"><b class="k">怎么打</b>一共 <b>5 题</b>，每题从本关的招里出。答得又快又准，星星越多。</div>
      <div class="t story"><b class="k">拿星标准</b>3★ 全对且够快 · 2★ 答对 4 题 · 1★ 答对 3 题（算通关）</div>
      ${s ? `<div class="t"><b class="k">我的记录</b>${'★'.repeat(s)}${'☆'.repeat(3-s)} · 最快 ${best} 秒</div>` : ''}
    </div>
    <div class="row center" style="margin-top:16px;">
      <button class="btn" onclick="questStart('${lv.id}')">开始闯关</button>
    </div>`;
  $('modal').classList.add('show');
}

function questStart(id){
  const lv = ALL_LEVELS.find(l => l.id === id);
  qState = {
    lv, i:0, score:0, total:5, results:[],
    t0: performance.now(), timer:null, locked:false, qs:[]
  };

  $('sheet').innerHTML = `
    <div class="sheet-head">
      <h3>${lv.name}</h3>
      <div class="pill y" id="q-timer">0.0 秒</div>
      <button class="closex" onclick="questQuit()">✕</button>
    </div>
    <div class="row" style="justify-content:space-between;margin:6px 0 10px;">
      <span class="pill" id="q-prog">第 1 / 5 题</span>
      <span class="pill g" id="q-score">✅ 0</span>
    </div>
    <div id="q-body"></div>
    <div class="sub center" id="q-fb" style="margin-top:10px;min-height:24px;"></div>`;

  qState.timer = setInterval(() => {
    const t = (performance.now() - qState.t0) / 1000;
    const e = $('q-timer');
    if (e) e.textContent = t.toFixed(1) + ' 秒';
  }, 100);

  questNext();
}

function questQuit(){
  if (qState && qState.timer) clearInterval(qState.timer);
  qState = null;
  closeModal();
}

function questNext(){
  const q = qState;
  if (!q) return;
  if (q.i >= q.total){ questFinish(); return; }

  q.locked = false;
  $('q-prog').textContent = '第 ' + (q.i+1) + ' / ' + q.total + ' 题';
  $('q-score').textContent = '✅ ' + q.score;
  $('q-fb').textContent = '';

  const question = makeQuestQuestion(q.lv);
  q.cur = question;
  renderQuestQuestion(question);
}

function makeQuestQuestion(lv){
  const stage = lv.stageKey === 'forest' ? 'F2L' : lv.stageKey === 'mountain' ? 'OLL' : 'PLL';
  const target = pick(lv.items);

  /* 题型：F2L 只考识别；OLL/PLL 有 50% 考特征 */
  let type = 'id';
  if (stage !== 'F2L') type = Math.random() < 0.45 ? 'feat' : 'id';

  const toks = parseNotation(target.notation);
  const caseCube = applyAlg(solvedCube(), invert(toks));

  if (type === 'id'){
    const pool = stage === 'F2L' ? DATA.F2L : (stage === 'OLL' ? DATA.OLL : DATA.PLL);
    const wrongs = shuffle(pool.filter(x => x.num !== target.num)).slice(0, 3);
    const opts = shuffle([target].concat(wrongs));
    return { type, stage, target, caseCube, opts };
  }

  /* 特征题 */
  if (stage === 'OLL'){
    const p = target.pattern;
    const cnt = p[1] + p[3] + p[5] + p[7];
    const opts = shuffle([0,1,2,3,4].filter(n => n !== cnt)).slice(0,3);
    return { type, stage, target, caseCube, feat:{ q:'顶面有几个<b>边块</b>是黄的？', ans:cnt, opts:shuffle([cnt].concat(opts)), unit:'个' } };
  }
  /* PLL：数车灯 */
  const r = target.ring;
  let lights = 0;
  if (r.F[0] === r.F[2]) lights++;
  if (r.B[0] === r.B[2]) lights++;
  if (r.L[0] === r.L[2]) lights++;
  if (r.R[0] === r.R[2]) lights++;
  const opts = shuffle([0,1,2,3,4].filter(n => n !== lights)).slice(0,3);
  return { type, stage, target, caseCube, feat:{ q:'侧面一共有几组<b>车灯</b>（相邻两个角块同色）？', ans:lights, opts:shuffle([lights].concat(opts)), unit:'组' } };
}

function renderQuestQuestion(q){
  const body = $('q-body');
  body.innerHTML = '';

  const stageName = q.stage;

  if (q.type === 'id'){
    body.innerHTML = `
      <div class="panel">
        <div class="ptitle"><b>看</b> 这是哪一个情形？用哪一招？</div>
        <div class="viewwrap"><div id="q-3d"></div></div>
        <div class="viewctrl" id="q-viewctrl"></div>
      </div>
      <div class="opts" id="q-opts"></div>`;

    const cv = cubeView($('q-3d'));
    cv.yaw = Math.PI/4; cv.pitch = Math.PI/6;
    drawCube($('q-3d'), q.caseCube, {});
    mountViewCtrl($('q-viewctrl'), () => $('q-3d'));

    const host = $('q-opts');
    q.opts.forEach(o => {
      const label = q.stage === 'PLL'
        ? o.name
        : (q.stage === 'OLL' ? (o.shape ? (OLL_FAMILY[o.shape[0]] ? OLL_FAMILY[o.shape[0]].nick : '') : '') + ' 第' + o.num + '式'
                             : '第' + o.num + '式');
      const b = el('button','opt','<span style="font-size:14.5px">' + label + '</span>');
      b.onclick = () => {
        if (qState.locked) return;
        qState.locked = true;
        const ok = (o.num === q.target.num);
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok){
          host.querySelectorAll('.opt').forEach(x => {
            const t = x.textContent.trim();
            const want = q.stage === 'PLL' ? q.target.name : ('第' + q.target.num + '式');
            if (t.indexOf(want) >= 0) x.classList.add('ok');
          });
        }
        questJudged(ok, ok ? '✅ 对了！' : ('正确是：' + (q.stage === 'PLL' ? q.target.name : '第' + q.target.num + '式')));
      };
      host.appendChild(b);
    });
  } else {
    body.innerHTML = `
      <div class="panel">
        <div class="ptitle"><b>数</b> 仔细看，回答问题</div>
        <div class="viewwrap"><div id="q-3d"></div></div>
        <div class="viewctrl" id="q-viewctrl"></div>
      </div>
      <div class="sense-q" style="font-size:17px;margin-top:12px;">${q.feat.q}</div>
      <div class="opts" id="q-opts"></div>`;

    const cv = cubeView($('q-3d'));
    cv.yaw = Math.PI/4; cv.pitch = Math.PI/6;
    drawCube($('q-3d'), q.caseCube, {});
    mountViewCtrl($('q-viewctrl'), () => $('q-3d'));

    const host = $('q-opts');
    q.feat.opts.forEach(v => {
      const b = el('button','opt','<span style="font-size:19px">' + v + ' ' + q.feat.unit + '</span>');
      b.onclick = () => {
        if (qState.locked) return;
        qState.locked = true;
        const ok = (v === q.feat.ans);
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok) host.querySelectorAll('.opt').forEach(x => { if (x.textContent.indexOf(q.feat.ans + ' ') === 0) x.classList.add('ok'); });
        questJudged(ok, ok ? '✅ 数对了！' : ('应该是 ' + q.feat.ans + ' ' + q.feat.unit));
      };
      host.appendChild(b);
    });
  }
}

function questJudged(ok, msg){
  const q = qState;
  if (ok) q.score++;
  q.results[q.i] = ok;
  q.i++;
  $('q-score').textContent = '✅ ' + q.score;
  $('q-fb').innerHTML = '<span style="font-weight:800;color:' + (ok ? 'var(--green)' : 'var(--red)') + '">' + msg + '</span>';
  setTimeout(() => { if (qState) questNext(); }, ok ? 500 : 1300);
}

function questFinish(){
  const q = qState;
  clearInterval(q.timer);

  const secs = (performance.now() - q.t0) / 1000;
  const right = q.score;
  const per = secs / q.total;

  let stars = 0;
  if (right === 5 && per <= 7.5) stars = 3;
  else if (right === 5) stars = 2;
  else if (right === 4) stars = 2;
  else if (right >= 3) stars = 1;

  const passed = stars >= 1;
  const k = questKey(q.lv.id);
  const prev = store.quest[k] || { stars:0, best:9999 };
  if (passed){
    const newBest = Math.min(prev.best === 9999 ? secs : prev.best, secs);
    store.quest[k] = { stars: Math.max(prev.stars||0, stars), best: Math.round(newBest) };
    saveStore();
    pushLog('通关 ' + q.lv.name + ' ' + '★'.repeat(store.quest[k].stars));
  }

  qState = null;

  $('sheet').innerHTML = `
    <div class="sheet-head">
      <h3>${q.lv.name}</h3>
      <button class="closex" onclick="closeModal()">✕</button>
    </div>
    <div class="center" style="padding:18px 0 6px;">
      <div style="font-size:54px">${stars >= 3 ? '🏆' : passed ? '🎉' : '💪'}</div>
      <div class="stars3" style="margin-top:4px;">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3-stars)}</span></div>
      <div class="huge" style="margin-top:8px">${right} / ${q.total}</div>
      <div class="sub">用时 ${secs.toFixed(1)} 秒 · 平均每题 ${per.toFixed(1)} 秒</div>
      <div class="sub" style="margin-top:10px;font-size:13.5px;">
        ${stars === 3 ? '完美！你已经是这一关的高手了。' :
          stars === 2 ? '很稳！再快一点就能 3 星。' :
          stars === 1 ? '过关啦，再练一次会更熟。' :
          '没过关。建议先去公式库把这几招的<b>认图</b>再看一遍。'}
      </div>
    </div>
    <div class="row center" style="margin-top:18px;">
      <button class="btn" onclick="questStart('${q.lv.id}')">再打一次</button>
      <button class="btn alt" onclick="closeModal();renderQuest()">回关卡列表</button>
    </div>`;

  $('modal').classList.add('show');
  refreshTopStars();

  /* 立刻刷新列表，保证解锁状态同步 */
  setTimeout(() => { if (currentPage === 'quest') { const m = $('modal').classList.contains('show'); renderQuest(); if (m) $('modal').classList.add('show'); } }, 10);
}
