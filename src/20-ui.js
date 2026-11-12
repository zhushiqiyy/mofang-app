/* =========================================================================
   20-ui.js — 路由 / 首页 / 学习地图 / 记号营 / 公式库 / 详情弹窗 / 关联练习 / 成就
   ========================================================================= */

const DATA = window.CFOP_DATA;
const STORE_KEY = 'cfop_kids_v2';

let store = loadStore();

function loadStore(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch(e){}
  if (!s){
    /* 从旧版本迁移已点亮的星星 */
    try {
      const old = JSON.parse(localStorage.getItem('cfop_kids_v1'));
      if (old && old.learned) s = { learned: old.learned, streak: old.streak, lastDay: old.lastDay };
    } catch(e){}
  }
  s = s || {};
  s.learned = s.learned || {};
  s.log = s.log || [];
  s.quest = s.quest || {};
  s.battle = s.battle || { w:0, l:0, d:0 };
  s.sense = s.sense || {};
  s.streak = s.streak || 0;
  s.lastDay = s.lastDay || null;
  /* 皮肤（cube=魔方特效，comp=玩伴）/ 记号连对 / 空间想象次数 */
  s.skins = s.skins || { cube:'classic', comp:'classic' };
  s.skins.cube = s.skins.cube || 'classic';
  s.skins.comp = s.skins.comp || 'classic';
  delete s.skins.owned;               /* 旧版商城的"已拥有"列表不再需要 */
  delete s.points;                    /* 旧版商城的积分不再需要 */
  s.notes = s.notes || { streak:0, best:0 };
  s.imagine = s.imagine || { count:0 };
  s.training = s.training || [];     /* 训练数据：实战复原 / 公式跟练 / 打乱练习等 */
  s.cloud = s.cloud || { url:'', auto:false };  /* 云端上传配置（endpoint 由用户填） */
  return s;
}
function saveStore(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch(e){} }

function keyOf(s,n){ return s + '-' + n; }
function isDone(s,n){ return !!store.learned[keyOf(s,n)]; }
function countDone(s){
  const arr = DATA[s.toUpperCase()];
  let n = 0;
  arr.forEach(it => { if (isDone(s, it.num)) n++; });
  return n;
}
function totalStars(){ return Object.keys(store.learned).filter(k => store.learned[k]).length; }
function todayStr(){
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
function updateStreak(){
  const t = todayStr();
  if (store.lastDay === t) return;
  if (store.lastDay){
    const pd = new Date(store.lastDay);
    const nx = new Date(pd.getTime() + 86400000);
    store.streak = (nx.toDateString() === new Date(t).toDateString()) ? (store.streak||0)+1 : 1;
  } else store.streak = 1;
  store.lastDay = t;
  saveStore();
}
function pushLog(txt){
  store.log.unshift({ t: Date.now(), txt });
  if (store.log.length > 60) store.log.length = 60;
  saveStore();
}
/* 记录一条训练数据（实战复原 / 公式跟练 / 打乱练习……）。供本地查看、导出、云端上传。 */
function recordTraining(ev){
  store.training = store.training || [];
  ev.t = Date.now();
  store.training.push(ev);
  if (store.training.length > 500) store.training.shift();
  saveStore();
}
function starTotal(){
  let n = 0;
  for (const k in store.quest){ n += (store.quest[k].stars || 0); }
  return n;
}

/* ---------------- 路由 ---------------- */
const TAB_PAGES = ['home','map','quest','lib','practice','gan','skin','data','ach'];
const PAGE_TITLE = {
  home:'魔方小将', map:'学习地图', sense:'色块感知训练', notes:'记号训练营',
  lib:'119 招公式库', quest:'闯关之路', relate:'关联练习',
  practice:'实战练习', ach:'成就墙', gan:'GAN356i', install:'安装到 iPad', skin:'皮肤小屋',
  data:'训练数据'
};
let currentPage = 'home';

function go(p){
  const node = document.getElementById('page-' + p);
  if (!node) return;
  document.querySelectorAll('.page').forEach(s => s.classList.remove('active'));
  node.classList.add('active');
  window.scrollTo(0, 0);
  currentPage = p;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.page === p));
  $('top-title').textContent = PAGE_TITLE[p] || '魔方小将';
  $('top-back').classList.toggle('show', TAB_PAGES.indexOf(p) < 0);
  refreshTopStars();
  renderPage(p);
}

function refreshTopStars(){
  $('top-stars').textContent = (totalStars() + starTotal()) + ' ⭐';
}

function renderPage(p){
  if (p === 'home')     renderHome();
  if (p === 'map')      renderMap();
  if (p === 'notes')    renderNotes();
  if (p === 'lib')      renderLib();
  if (p === 'quest')    renderQuest();
  if (p === 'relate')   renderRelate();
  if (p === 'practice') renderPractice();
  if (p === 'ach')      renderAch();
  if (p === 'skin')     renderSkinRoom();
  if (p === 'sense')    renderSenseEntry();
  if (p === 'gan')      ganShowEnv();
  if (p === 'data')     renderData();
}

$('tabbar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) go(b.dataset.page);
});
$('top-back').addEventListener('click', () => go('home'));

/* ---------------- 首页 ---------------- */
function renderHome(){
  $('home-stars').textContent = totalStars() + ' ⭐';
  $('home-streak').textContent = store.streak || 0;
  $('home-5star').textContent = Object.keys(store.quest).filter(k => store.quest[k].stars >= 3).length;

  const host = $('home-bars');
  host.innerHTML = '';
  [
    ['f2l','🟦 F2L 森林',41,'#3a7afe'],
    ['oll','🟨 OLL 山顶',57,'#ffc400'],
    ['pll','🟥 PLL 城堡',21,'#ff5a6e']
  ].forEach(([s,nm,tot,col]) => {
    const dn = countDone(s);
    const d = el('div');
    d.style.margin = '12px 0';
    d.appendChild(el('div','row', `<span>${nm}</span><span class="pill">${dn} / ${tot}</span>`));
    d.querySelector('.row').style.justifyContent = 'space-between';
    const bar = el('div','bar');
    const i = el('i');
    i.style.width = (dn/tot*100) + '%';
    if (col === '#ffc400') i.style.background = 'linear-gradient(90deg,#ffc400,#ffd95e)';
    if (col === '#ff5a6e') i.style.background = 'linear-gradient(90deg,#ff5a6e,#ff8fa0)';
    bar.appendChild(i);
    d.appendChild(bar);
    host.appendChild(d);
  });

  /* 玩伴 */
  renderCompanion($('home-companion'));
}

/* ---------------- 学习地图 ---------------- */
const PHASES = [
  {
    em: '🥇', title:'第 1 阶段 · 眼睛和手指先学会',
    desc:'先不碰公式。练两件事：<b>看一眼就知道哪面是哪面</b>（色块感知），以及<b>看到 R U F\' 就知道手往哪走</b>（记号本能）。',
    need:'每天 10 分钟，约 1 周。',
    pass:'感知训练 3 星 + 记号营连续 3 次全对',
    btns:[['👀 色块感知训练','sense'],['🔤 记号训练营','notes']]
  },
  {
    em: '🟦', title:'第 2 阶段 · F2L 直觉（不求背完）',
    desc:'F2L 不是背 41 个！先搞懂一件事：<b>角块和棱块要配成一对</b>，再一起塞进槽。先学 6 个"标准配对"，能自己拧出来就够了。',
    need:'每天 2~3 招，约 2 周。',
    pass:'"标准配对"6 招点亮⭐',
    btns:[['📚 打开 F2L 公式库','lib-f2l']]
  },
  {
    em: '🟨', title:'第 3 阶段 · 两步 OLL（只要 9 招）',
    desc:'只学：<b>十字 3 招 + 小鱼 2 招 + 角全黄 4 招</b>。学会这几招，顶层翻黄不用再慢慢来，成绩会明显变快。',
    need:'每天 1~2 招，约 1 周。',
    pass:'两步 OLL 相关招式点亮⭐',
    btns:[['🟨 打开 OLL（按形状分组）','lib-oll']]
  },
  {
    em: '🟥', title:'第 4 阶段 · 两步 PLL（只要 6 招）',
    desc:'只学：<b>Ua、Ub、H、Z、T、Y</b>。这 6 招覆盖了绝大多数情况，顶层摆位一次搞定。',
    need:'每天 1 招，约 1 周。',
    pass:'这 6 招点亮⭐',
    btns:[['🟥 打开 PLL 公式库','lib-pll']]
  },
  {
    em: '🚀', title:'第 5 阶段 · 补满 119 招',
    desc:'按形状一族一族地补：闪电 → 方框 → 马步 → C 形……每天 2~3 招，配合闯关检验。',
    need:'每天 2~3 招，约 1 个月。',
    pass:'119 招全亮⭐ + 城堡全 3 星',
    btns:[['⚔️ 去闯关','quest']]
  }
];

function renderMap(){
  $('map-think').innerHTML = `
    <h3>🧠 先搞懂：层先法 vs CFOP 思维</h3>
    <div class="talk">
      <div class="t"><b class="k">层先法</b>一块一块来：先把整个白色面拼好，再一层一层往上盖。像<b>盖房子</b>，一层盖完再盖上一层。</div>
      <div class="t story"><b class="k">CFOP</b>先搭一个白色十字（Cross），然后<b>把角块和棱块配成一对，一起塞进槽</b>（F2L），最后顶层两步：先全部翻黄（OLL），再摆到正确位置（PLL）。</div>
      <div class="t"><b class="k">一句话</b>层先法是"一块一块"，CFOP 是"<b>一对一对</b>"。一对一起走，手就少走很多冤枉路——这就是为什么 CFOP 更快。</div>
    </div>`;

  const host = $('map-phases');
  host.innerHTML = '';
  PHASES.forEach((p, idx) => {
    const c = el('div','card');
    c.innerHTML = `
      <div class="row" style="align-items:flex-start;gap:12px;">
        <div style="font-size:30px;line-height:1">${p.em}</div>
        <div style="flex:1;min-width:0;">
          <h3 style="margin-bottom:4px">${p.title}</h3>
          <div class="sub" style="line-height:1.75">${p.desc}</div>
          <div class="row" style="margin-top:8px;gap:6px;">
            <span class="pill">⏱ ${p.need}</span>
          </div>
          <div class="sub" style="margin-top:6px;font-size:12.5px;">✅ 过关标准：${p.pass}</div>
          <div class="row" style="margin-top:10px;">
            ${p.btns.map(([lb, act]) => `<button class="btn alt sm" data-act="${act}">${lb}</button>`).join('')}
          </div>
        </div>
      </div>`;
    c.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'lib-f2l'){ libStage = 'F2L'; go('lib'); }
        else if (a === 'lib-oll'){ libStage = 'OLL'; go('lib'); }
        else if (a === 'lib-pll'){ libStage = 'PLL'; go('lib'); }
        else go(a);
      };
    });
    host.appendChild(c);
  });
}

/* ---------------- 记号营 ---------------- */
let noteCube = solvedCube();
let noteBusy = null;

function renderNotes(){
  drawCube($('note-3d'), noteCube, { showCenters:true });
  mountViewCtrl($('note-viewctrl'), () => $('note-3d'));
  buildPlanar($('note-planar'), noteCube);

  const host = $('note-btns');
  if (!host.dataset.built){
    host.dataset.built = '1';
    ['U','D','F','B','R','L'].forEach(f => {
      const line = el('div');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap;';
      line.appendChild(el('div','pill', `${FACE_NAME[f]} ${f}`));
      [['', f], ["'", f + "'"], ['2', f + '2']].forEach(([sfx, label]) => {
        const b = el('button','btn alt sm', label);
        b.style.minWidth = '58px';
        b.onclick = () => noteDo(f, sfx === "'", sfx === '2');
        line.appendChild(b);
      });
      line.appendChild(el('span','sub', NOTE_INFO[f].tip.replace(/<b>/g,'').replace(/<\/b>/g,'')));
      host.appendChild(line);
    });
  }
  noteResetSilent();

  noteQuizNew();
}

function noteResetSilent(){
  noteCube = solvedCube();
  drawCube($('note-3d'), noteCube, { showCenters:true });
  buildPlanar($('note-planar'), noteCube);
  $('note-tip').innerHTML = '点上面的按钮，看魔方怎么转 ~';
}
function noteReset(){ noteResetSilent(); }

function noteToggleCenter(){
  drawCube($('note-3d'), noteCube, { showCenters:true, yaw:0, pitch:0.05 });
}

function noteDo(f, prime, dbl){
  if (noteBusy) noteBusy.cancel();
  const tok = { f, prime: !!prime, dbl: !!dbl };
  const info = NOTE_INFO[f];
  const label = f + (dbl ? '2' : prime ? "'" : '');
  $('note-tip').innerHTML = `<b>${label}</b> = ${info.tip} <span class="sub">（${info.finger}）</span>`;
  noteBusy = animateAlg($('note-3d'), noteCube, [tok], {
    speed: 0.75,
    onDone: c => {
      noteCube = c;
      drawCube($('note-3d'), noteCube, { showCenters:true });
      buildPlanar($('note-planar'), noteCube);
      noteBusy = null;
    }
  });
}

/* 记号小测：看 3D 状态，问刚才转了哪一步 */
let noteQuizState = null;
function noteQuizNew(){
  const faces = ['U','R','F','L','D','B'];
  const f = pick(faces);
  const variant = pick([0,1,2]);
  const tok = { f, prime: variant === 1, dbl: variant === 2 };
  const label = f + (tok.dbl ? '2' : tok.prime ? "'" : '');

  const before = solvedCube();
  const after = applyAlg(before, [tok]);

  noteQuizState = { label };

  $('note-quiz-q').innerHTML = `这个魔方刚刚被转了<b>一步</b>，是下面哪一个？`;
  drawCube($('note-quiz-3d'), after, {});

  const opts = [];
  opts.push(label);
  const pool = ['U','U\'','U2','R','R\'','R2','F','F\'','F2','L','L\'','L2','D','D\'','D2','B','B\'','B2'];
  const wrong = shuffle(pool.filter(x => x !== label)).slice(0,3);
  const all = shuffle([label].concat(wrong));

  const host = $('note-quiz-opts');
  host.innerHTML = '';
  all.forEach(x => {
    const b = el('button','opt','<span class="mono">' + x + '</span>');
    b.onclick = () => {
      host.querySelectorAll('.opt').forEach(o => { o.onclick = null; });
      if (x === label){ b.classList.add('ok'); toast('✅ 答对了！'); }
      else {
        b.classList.add('no');
        host.querySelectorAll('.opt').forEach(o => { if (o.textContent === label) o.classList.add('ok'); });
        toast('再看看：正确答案是 ' + label);
      }
      /* 连续答对计数（用于进阶路线「记号本能」关卡） */
      store.notes = store.notes || { streak:0, best:0 };
      if (x === label){
        store.notes.streak = (store.notes.streak||0) + 1;
        store.notes.best = Math.max(store.notes.best||0, store.notes.streak);
      } else {
        store.notes.streak = 0;
      }
      saveStore();
    };
    host.appendChild(b);
  });
}

/* ---------------- 公式库 ---------------- */
let libStage = 'F2L';
let libFilterKey = 'all';

const OLL_ORDER = ['点','十字','小鱼','C形','T形','马步','方框','小闪电','L形','P形','角已定向'];

function renderLib(){
  const tabs = $('lib-tabs');
  tabs.innerHTML = '';
  [['F2L','🟦 F2L','41'],['OLL','🟨 OLL','57'],['PLL','🟥 PLL','21']].forEach(([s,lb,n]) => {
    const b = el('button','chip' + (libStage === s ? ' on' : ''), lb + ' <span style="opacity:.7">' + n + '</span>');
    b.onclick = () => { libStage = s; libFilterKey = 'all'; renderLib(); };
    tabs.appendChild(b);
  });

  /* 过滤条 */
  const fbar = $('lib-filter');
  fbar.innerHTML = '';
  const arr = DATA[libStage];
  let keys = [];
  if (libStage === 'OLL'){
    const cnt = {};
    arr.forEach(it => { const k = it.shape ? it.shape[0] : '其他'; cnt[k] = (cnt[k]||0)+1; });
    keys = OLL_ORDER.filter(k => cnt[k]).map(k => [k, k + ' ' + cnt[k]]);
  } else if (libStage === 'PLL'){
    const g = {};
    arr.forEach(it => { g[it.group] = (g[it.group]||0)+1; });
    keys = Object.keys(g).map(k => [k, k + ' ' + g[k]]);
  } else {
    const g = {};
    arr.forEach(it => { g[it.group] = (g[it.group]||0)+1; });
    keys = Object.keys(g).map(k => [k, (F2L_GROUP_INFO[k] ? F2L_GROUP_INFO[k].nick : k) + ' ' + g[k]]);
  }

  const allChip = el('button','chip' + (libFilterKey === 'all' ? ' on' : ''), '全部 ' + arr.length);
  allChip.onclick = () => { libFilterKey = 'all'; renderLib(); };
  fbar.appendChild(allChip);
  keys.forEach(([k, lb]) => {
    const b = el('button','chip' + (libFilterKey === k ? ' on' : ''), lb);
    b.onclick = () => { libFilterKey = k; renderLib(); };
    fbar.appendChild(b);
  });

  /* 列表 */
  const list = arr.filter(it => {
    if (libFilterKey === 'all') return true;
    if (libStage === 'OLL') return (it.shape ? it.shape[0] : '其他') === libFilterKey;
    return it.group === libFilterKey;
  });

  $('lib-count').textContent = list.length + ' 招';
  $('lib-done').textContent = '已学 ' + countDone(libStage);

  const grid = $('lib-grid');
  grid.innerHTML = '';
  list.forEach(it => {
    const card = el('div','gcard' + (isDone(libStage, it.num) ? ' star' : ''));
    card.appendChild(el('div','no', (libStage === 'PLL' ? it.name : shortName(libStage, it))));
    card.appendChild(el('div','lb', libStage === 'PLL' ? ('第 ' + it.num + ' 式') : ('第 ' + it.num + ' 招')));
    if (libStage === 'OLL' && it.pattern) card.appendChild(ollThumb(it.pattern, 12));
    card.onclick = () => openFormula(libStage, it.num);
    grid.appendChild(card);
  });
}

/* ---------------- 公式详情弹窗 ---------------- */
let mState = null;

function closeModal(){
  if (mState && mState.anim) mState.anim.cancel();
  if (formulaFollow) formulaFollow.active = false;   /* 关弹窗即退出跟练，避免后台误驱动 */
  mState = null;
  $('modal').classList.remove('show');
}
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function openFormula(stage, num){
  const arr = DATA[stage];
  const it = arr.find(x => x.num === num);
  if (!it) return;

  const toks = parseNotation(it.notation);
  const caseCube = applyAlg(solvedCube(), invert(toks));
  const info = explainOf(stage, it);
  const cmp = contrastOf(stage, it);
  const imag = imagineOf(stage, it);

  mState = { stage, it, toks, caseCube, cur: caseCube, idx: 0, anim: null, playing: false, speed: 1 };

  const head = `
    <div class="sheet-head">
      <h3>${stage} · 第 ${it.num} 式 · ${info.title}</h3>
      <button class="closex" onclick="closeModal()">✕</button>
    </div>
    <div class="sub" style="margin-bottom:10px;">下面左边是<b>还没解的样子</b>（3D 可拖动），右边是同一时刻的<b>平面展开</b>。</div>

    <div class="duo">
      <div class="panel">
        <div class="ptitle"><b>3D</b> 轴测视图 · 情形 → 复原</div>
        <div class="viewwrap"><div id="m-3d"></div></div>
        <div class="viewctrl" id="m-viewctrl"></div>
        <div class="row center" style="margin-top:10px;gap:8px;">
          <button class="btn sm" id="m-play">▶ 播放</button>
          <button class="btn alt sm" id="m-step">⏭ 单步</button>
          <button class="btn alt sm" id="m-reset">↺ 回情形</button>
        </div>
        <div class="row center" style="margin-top:8px;">
          <span class="sub" style="font-size:12.5px;">速度</span>
          <input id="m-speed" type="range" min="0.5" max="2" step="0.25" value="1" style="flex:1;max-width:150px;">
        </div>
      </div>

      <div class="panel">
        <div class="ptitle"><b>平面</b> 六个面（分开放，看得清）</div>
        <div class="planar" id="m-planar"></div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px;">
      <div class="ptitle"><b>认图</b> 一眼认出这一招</div>
      <div id="m-chart"></div>
    </div>
  `;

  const body = `
    <div class="card" style="margin-top:14px;background:#f8fbff;border:1px solid var(--line);">
      <div class="sub" style="font-size:12.5px;margin-bottom:4px;">公式（点下面每一段，跟着转一段）</div>
      <div class="mono" style="font-size:19px;font-weight:800;letter-spacing:1px;word-break:break-all;">${it.notation}</div>
      <div class="chunks" id="m-chunks"></div>
      <div class="sub" id="m-chunk-tip" style="font-size:12.5px;">👆 点一段，就只转那一段</div>
    </div>

    <div class="talk">
      ${info.story ? `<div class="t story"><b class="k">像什么</b>${info.story}</div>` : ''}
      ${info.look ? `<div class="t"><b class="k">先看哪</b>${info.look}</div>` : ''}
      ${info.extra ? `<div class="t"><b class="k">认图线索</b>${info.extra.replace(/^认图：/,'')}</div>` : ''}
      <div class="t"><b class="k">口诀</b>${rhymeOf(stage, it)}</div>
      <div class="t"><b class="k">这一步在干嘛</b>${it.how || ''}</div>
      ${info.feel ? `<div class="t"><b class="k">小提示</b>${info.feel}</div>` : ''}
    </div>

    ${cmp ? `
    <div class="card tight" style="margin-top:14px;background:#f3f7ff;border:1.5px solid #d8e5ff;">
      <div class="ptitle" style="color:var(--blue);font-weight:900;font-size:14px;margin-bottom:8px;">
        🆚 和一招比一比：<b>${cmp.myNick}</b> vs <b>${cmp.otNick}</b>
      </div>
      <div class="cmp-row">
        <div class="cmp-col mine">
          <div class="cmp-h">这一招 · ${cmp.myNick}</div>
          <div class="mono cmp-alg">${it.notation}</div>
          <div class="cmp-sub">${it.title || ''}</div>
        </div>
        <div class="cmp-mid">VS</div>
        <div class="cmp-col">
          <div class="cmp-h">最像的 · ${cmp.otNick}</div>
          <div class="mono cmp-alg">${cmp.other.notation}</div>
          <div class="cmp-sub">${cmp.other.title || ''}</div>
        </div>
      </div>
      <div class="talk" style="margin-top:10px;">
        <div class="t"><b class="k">哪里一样</b>${cmp.how}</div>
        <div class="t"><b class="k">怎么选</b>${cmp.pick}</div>
        <div class="t story"><b class="k">一句话记住</b>两招长得像，就<b>只看不一样的那一块</b>——把 ${
          stage === 'PLL' ? '车灯（相邻同色角）' : stage === 'OLL' ? '顶面黄的形状' : '角块和棱块谁先贴上去'
        } 看清楚，就不会选错。</div>
      </div>
    </div>` : ''}

    <div class="card tight" style="margin-top:14px;background:#fffaf0;border:1.5px solid #ffe0a3;">
      <div class="ptitle" style="color:#8a6500;font-weight:900;font-size:14px;margin-bottom:6px;">🧠 先想一想（练空间想象）</div>
      <div style="font-size:14.5px;line-height:1.75;">${imag}</div>
      <div class="row" style="margin-top:10px;">
        <button class="btn alt sm" id="m-hide">🙈 把图遮住，凭想象回答</button>
      </div>
      <div class="sub" id="m-hide-tip" style="margin-top:8px;font-size:12.5px;display:none;">
        图已遮住。在脑子里"转"一遍，然后再点一次揭晓。
      </div>
    </div>

    <div class="row center" style="margin-top:16px;gap:10px;">
      <button class="btn green" id="m-done">⭐ 我会了</button>
      <button class="btn alt" id="m-quiz">🎯 考考我</button>
      <button class="btn alt" id="m-related">🔗 看同族</button>
      <button class="btn blue" id="m-follow">🔗 连真魔方跟练</button>
    </div>

    <div class="card tight" id="m-follow-panel" style="display:none;margin-top:14px;background:#f0f7ff;border:1.5px solid #bcd8ff;">
      <div class="ptitle" style="color:var(--blue);font-weight:900;font-size:14px;margin-bottom:6px;">🎮 真魔方跟练（蓝牙）</div>
      <div id="m-follow-status" class="sub" style="font-size:12.5px;min-height:18px;">点「开始跟练」连上真魔方。</div>
      <div class="sub" style="font-size:12.5px;margin-top:6px;">先把真魔方拧成<b>上面这张图</b>的样子（对照 3D 轴测图），再照下面的公式一步步拧，屏幕会<b>实时检查</b>每一步。</div>
      <div class="chunks" id="m-follow-steps" style="margin-top:8px;"></div>
      <div id="m-follow-fb" class="sub" style="font-size:13px;margin-top:8px;font-weight:700;"></div>
      <div class="row center" style="margin-top:10px;gap:8px;">
        <button class="btn blue sm" id="m-follow-toggle">开始跟练</button>
        <button class="btn alt sm" id="m-follow-reset">↺ 重来</button>
      </div>
    </div>

    <div class="row center" style="margin-top:10px;">
      <button class="btn ghost sm" id="m-prev">◀ 上一式</button>
      <button class="btn ghost sm" id="m-next">下一式 ▶</button>
    </div>
  `;

  $('sheet').innerHTML = head + body;
  $('modal').classList.add('show');
  $('sheet').scrollTop = 0;

  /* 初始绘制 */
  drawCube($('m-3d'), caseCube, {});
  mountViewCtrl($('m-viewctrl'), () => $('m-3d'));
  buildPlanar($('m-planar'), caseCube);

  /* 认图面板 */
  const ch = $('m-chart');
  if (stage === 'PLL' && it.ring){
    buildChart(ch, { ring: it.ring }, { mode:'pll' });
    const lg = el('div','chart-legend');
    lg.innerHTML = '<span><i style="background:' + COLORS.y + '"></i>顶面（全黄）</span>' +
                   '<span><i style="background:#d9e0ee"></i>四周 = 侧面顶层一圈</span>';
    ch.appendChild(lg);
  } else if (stage === 'OLL' && it.pattern){
    const g = el('div');
    g.style.cssText = 'display:grid;grid-template-columns:repeat(3,42px);gap:4px;justify-content:center;margin:6px auto;';
    it.pattern.forEach(v => {
      const d = el('div');
      d.style.cssText = 'width:42px;height:42px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);background:' + (v ? COLORS[UP_COLOR] : '#d9e0ee') + ';';
      g.appendChild(d);
    });
    ch.appendChild(g);
    const lab = el('div','chart-label','白色的地方 = 顶面已经翻上来（这是从正上方往下看的样子）');
    ch.appendChild(lab);
  } else {
    /* F2L：展示角块+棱块的位置关系 */
    const lab = el('div','chart-label');
    lab.innerHTML = '<b>看什么：</b>目标槽是<b>右前方</b>。先找"角块"（带白色）和"棱块"，看它们是不是已经贴在一起。';
    ch.appendChild(lab);
  }

  /* 分段 */
  const chunks = splitChunks(it.raw || it.notation);
  const chost = $('m-chunks');
  chost.innerHTML = '';
  chunks.forEach((c, i) => {
    const b = el('button','chunk', c);
    b.onclick = () => playChunk(i);
    chost.appendChild(b);
  });

  /* 绑定控制 */
  $('m-play').onclick = () => {
    if (mState.playing){ stopPlay(); return; }
    playFrom(0);
  };
  $('m-step').onclick = () => { stopPlay(); stepOnce(); };
  $('m-reset').onclick = () => { stopPlay(); resetToCase(); };
  $('m-speed').oninput = e => { if (mState) mState.speed = parseFloat(e.target.value); };

  /* 遮住图，凭想象回答（练空间想象） */
  const hideBtn = $('m-hide');
  if (hideBtn){
    hideBtn.onclick = () => {
      const on = !$('m-3d').classList.contains('masked');
      ['m-3d','m-planar','m-chart'].forEach(id => { const n = $(id); if (n) n.classList.toggle('masked', on); });
      $('m-hide-tip').style.display = on ? 'block' : 'none';
      hideBtn.textContent = on ? '👀 揭晓答案' : '🙈 把图遮住，凭想象回答';
      /* 每次「揭晓答案」算一次空间想象练习（用于进阶路线） */
      if (!on){
        store.imagine = store.imagine || { count:0 };
        store.imagine.count = (store.imagine.count||0) + 1;
        saveStore();
      }
    };
  }

  $('m-done').onclick = () => {
    const k = keyOf(stage, it.num);
    if (store.learned[k]){ delete store.learned[k]; toast('取消点亮'); }
    else { store.learned[k] = true; updateStreak(); pushLog('学会 ' + stage + ' 第 ' + it.num + ' 式'); toast('⭐ 点亮！已学 ' + totalStars() + ' 招'); }
    saveStore();
    refreshTopStars();
    renderLib();
    $('m-done').textContent = isDone(stage, it.num) ? '⭐ 已点亮（再点取消）' : '⭐ 我会了';
  };
  $('m-done').textContent = isDone(stage, it.num) ? '⭐ 已点亮（再点取消）' : '⭐ 我会了';

  $('m-quiz').onclick = () => { closeModal(); go('relate'); };
  $('m-related').onclick = () => { closeModal(); go('relate'); };

  /* 真魔方跟练（蓝牙）按钮 */
  $('m-follow').onclick = () => {
    const p = $('m-follow-panel');
    if (p) p.style.display = (p.style.display === 'none' ? 'block' : 'none');
  };
  $('m-follow-toggle').onclick = () => toggleFormulaFollow();
  $('m-follow-reset').onclick = () => resetFormulaFollow();

  const idx = arr.findIndex(x => x.num === num);
  $('m-prev').disabled = idx <= 0;
  $('m-next').disabled = idx >= arr.length - 1;
  $('m-prev').onclick = () => openFormula(stage, arr[idx-1].num);
  $('m-next').onclick = () => openFormula(stage, arr[idx+1].num);
}

/* ---------------- 真魔方跟练（蓝牙，逐步检查 + 训练意见） ---------------- */
let formulaFollow = null;   /* { stage, it, toks, caseCube, stack, cube, active, started } */

function mFollowTokEq(a, b){ return a.f === b.f && !!a.prime === !!b.prime && !!a.dbl === !!b.dbl; }
function mFollowInv(t){ return t.dbl ? { f:t.f, prime:t.prime, dbl:true } : { f:t.f, prime:!t.prime, dbl:false }; }
function mFollowFmt(t){ return t.f + (t.prime ? "'" : '') + (t.dbl ? '2' : ''); }

function startFormulaFollow(){
  if (!mState) return;
  formulaFollow = {
    stage: mState.stage, it: mState.it, toks: mState.toks.slice(),
    caseCube: mState.caseCube, stack: [], cube: mState.caseCube, active: true, started: true
  };
  renderFollowSteps();
  setFollowFb('准备就绪，先照着图把真魔方拧成那个样子，再拧第一步！', '#1a7fd2');
  const tg = $('m-follow-toggle'); if (tg) tg.textContent = '⏸ 暂停跟练';
  if (!ganConn) pracConnectGAN();
  else followSetStatus('✅ 已连上真魔方，直接拧吧');
}

function toggleFormulaFollow(){
  if (!formulaFollow || !formulaFollow.started){ startFormulaFollow(); return; }
  formulaFollow.active = !formulaFollow.active;
  const tg = $('m-follow-toggle');
  if (tg) tg.textContent = formulaFollow.active ? '⏸ 暂停跟练' : '继续跟练';
  setFollowFb(formulaFollow.active ? '继续吧！' : '已暂停，再点继续。', '#1a7fd2');
}

function resetFormulaFollow(){
  if (!formulaFollow) return;
  formulaFollow.stack = [];
  formulaFollow.cube = formulaFollow.caseCube;
  drawCube($('m-3d'), formulaFollow.cube, {});
  renderFollowSteps();
  setFollowFb('已重来，从第一步开始。', '#1a7fd2');
}

function renderFollowSteps(){
  const host = $('m-follow-steps');
  if (!host || !formulaFollow) return;
  host.innerHTML = '';
  const t = formulaFollow.toks, st = formulaFollow.stack;
  t.forEach((tk, i) => {
    const b = el('button', 'chunk', mFollowFmt(tk));
    if (i < st.length) b.classList.add(mFollowTokEq(st[i], tk) ? 'ok' : 'bad');
    else if (i === st.length) b.classList.add('now');
    host.appendChild(b);
  });
}

function setFollowFb(txt, color){ const e = $('m-follow-fb'); if (e){ e.textContent = txt; if (color) e.style.color = color; } }
function followSetStatus(html){ const e = $('m-follow-status'); if (e) e.innerHTML = html; }

/* 真魔方每转一步都会调到这里：镜像到屏幕 + 逐步检查 + 给训练意见 */
function formulaFollowMove(label){
  if (!formulaFollow || !formulaFollow.active) return;
  const tok = { f: label[0], prime: label.indexOf("'") > 0, dbl: label.indexOf('2') > 0 };
  const st = formulaFollow.stack;
  if (st.length && mFollowTokEq(st[st.length-1], mFollowInv(tok))) st.pop();   /* 拧反了＝撤销上一步 */
  else st.push(tok);

  let cube = formulaFollow.caseCube;
  st.forEach(t => { cube = applyMove(cube, moveOf(t)) || cube; });
  formulaFollow.cube = cube;
  drawCube($('m-3d'), cube, {});
  renderFollowSteps();

  const t = formulaFollow.toks;
  let wrong = -1;
  for (let i = 0; i < st.length; i++){ if (!mFollowTokEq(st[i], t[i])){ wrong = i; break; } }
  if (wrong >= 0){
    setFollowFb('❌ 第' + (wrong+1) + '步拧成了 ' + mFollowFmt(st[wrong]) + '，应该是 ' + mFollowFmt(t[wrong]) + '（方向或顺序不对，照图上箭头拧回去重来就可以）', '#d23b3b');
  } else if (st.length >= t.length){
    setFollowFb('🎉 这一招跟练完成！整条公式都对上了，真棒！', '#1a9e4b');
    if (typeof recordTraining === 'function')
      recordTraining({ kind:'formula', stage: formulaFollow.stage, num: formulaFollow.it.num, ok:true, moves: st.length });
  } else {
    setFollowFb('✅ 已对 ' + st.length + ' / ' + t.length + ' 步，下一步：' + mFollowFmt(t[st.length]), '#1a7fd2');
  }
}

function splitChunks(raw){
  const s = String(raw || '').replace(/\s+/g, '');
  const out = [];
  const re = /\(([^)]*)\)|([URDLFBurldfbmsexyzMSE]['’]?2?)/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1] || m[2]);
  return out.length ? out : [s];
}

function stopPlay(){
  if (!mState) return;
  if (mState.anim){ mState.anim.cancel(); mState.anim = null; }
  mState.playing = false;
  const b = $('m-play');
  if (b) b.textContent = '▶ 播放';
  const cs = document.querySelectorAll('#m-chunks .chunk');
  cs.forEach(c => c.classList.remove('now'));
}

function updateProgressUI(){
  if (!mState) return;
  const cs = document.querySelectorAll('#m-chunks .chunk');
  cs.forEach((c, i) => c.classList.toggle('done', i < mState.idx));
  const tip = $('m-chunk-tip');
  if (tip) tip.textContent = mState.idx >= mState.toks.length
    ? '🎉 转完啦！这个情形被解开了。'
    : '进度：' + mState.idx + ' / ' + mState.toks.length + ' 步';
}

function playFrom(startIdx){
  if (!mState) return;
  mState.playing = true;
  $('m-play').textContent = '⏸ 暂停';
  const rest = mState.toks.slice(startIdx);
  mState.idx = startIdx;
  mState.anim = animateAlg($('m-3d'), mState.cur, rest, {
    speed: mState.speed,
    onStep: (i, cube) => { mState.cur = cube; mState.idx = startIdx + i + 1; updateProgressUI(); },
    onDone: cube => {
      mState.cur = cube;
      mState.idx = mState.toks.length;
      mState.playing = false;
      mState.anim = null;
      $('m-play').textContent = '▶ 播放';
      updateProgressUI();
      buildPlanar($('m-planar'), cube);
      markChunksDone();
      toast('🎉 复原完成！');
    }
  });
}

function markChunksDone(){
  document.querySelectorAll('#m-chunks .chunk').forEach(c => c.classList.add('done'));
}

function stepOnce(){
  if (!mState) return;
  if (mState.idx >= mState.toks.length){ resetToCase(); return; }
  const t = mState.toks[mState.idx];
  mState.anim = animateAlg($('m-3d'), mState.cur, [t], {
    speed: mState.speed,
    onDone: cube => {
      mState.cur = cube;
      mState.idx++;
      mState.anim = null;
      drawCube($('m-3d'), cube, {});
      buildPlanar($('m-planar'), cube);
      updateProgressUI();
    }
  });
}

function resetToCase(){
  if (!mState) return;
  mState.cur = mState.caseCube;
  mState.idx = 0;
  drawCube($('m-3d'), mState.caseCube, {});
  buildPlanar($('m-planar'), mState.caseCube);
  document.querySelectorAll('#m-chunks .chunk').forEach(c => c.classList.remove('done'));
  updateProgressUI();
}

function playChunk(i){
  if (!mState) return;
  stopPlay();
  const chunks = splitChunks(mState.it.raw || mState.it.notation);
  const toks = parseNotation(chunks[i] || '');
  if (!toks.length) return;
  const cs = document.querySelectorAll('#m-chunks .chunk');
  cs.forEach((c, j) => c.classList.toggle('now', j === i));

  /* 从当前状态播放这一段 */
  mState.anim = animateAlg($('m-3d'), mState.cur, toks, {
    speed: mState.speed,
    onDone: cube => {
      mState.cur = cube;
      mState.anim = null;
      cs[i].classList.add('done');
      cs[i].classList.remove('now');
      drawCube($('m-3d'), cube, {});
      buildPlanar($('m-planar'), cube);
      const tip = $('m-chunk-tip');
      if (tip) tip.textContent = '这一段：' + (chunks[i] || '') + '（已转）';
    }
  });
}

/* ---------------- 关联练习 ---------------- */
let relateStageKey = 'OLL';
let relateCur = null;

function renderRelate(){
  const chips = $('relate-stage-chips');
  chips.innerHTML = '';
  [['OLL','🟨 OLL 认形'],['PLL','🟥 PLL 认位']].forEach(([s, lb]) => {
    const b = el('button','chip' + (relateStageKey === s ? ' on' : ''), lb);
    b.onclick = () => { relateStageKey = s; renderRelate(); };
    chips.appendChild(b);
  });
  relateNew();
  relatePair();
}

function relateNew(){
  const arr = DATA[relateStageKey];
  const target = pick(arr);
  const toks = parseNotation(target.notation);
  const caseCube = applyAlg(solvedCube(), invert(toks));

  relateCur = { target, caseCube };

  const host = $('relate-3d');
  drawCube(host, caseCube, {});

  /* 用 3D 情形图 + 4 个选项 */
  const others = shuffle(arr.filter(x => x.num !== target.num)).slice(0, 3);
  const all = shuffle([target].concat(others));

  const opts = $('relate-opts');
  opts.innerHTML = '';
  all.forEach(o => {
    const label = relateStageKey === 'PLL'
      ? o.name
      : (shortName('OLL', o) + ' · 第' + o.num + '式');
    const b = el('button','opt','<span class="mono">' + label + '</span>');
    b.onclick = () => {
      opts.querySelectorAll('.opt').forEach(x => { x.onclick = null; });
      if (o.num === target.num){ b.classList.add('ok'); toast('✅ 就是它！'); }
      else {
        b.classList.add('no');
        opts.querySelectorAll('.opt').forEach(x => {
          if (x.textContent.indexOf(target.num + '式') >= 0 || x.textContent === target.name) x.classList.add('ok');
        });
        const info = explainOf(relateStageKey, target);
        toast('正确答案：' + (relateStageKey === 'PLL' ? target.name : info.title));
      }
    };
    opts.appendChild(b);
  });
}

/* 易混对子：同族两招并排 */
function relatePair(){
  const host = $('relate-pair');
  host.innerHTML = '';

  let a, b;
  if (relateStageKey === 'OLL'){
    const fam = pick(OLL_ORDER.filter(k => DATA.OLL.filter(x => x.shape && x.shape[0] === k).length >= 2));
    const pool = DATA.OLL.filter(x => x.shape && x.shape[0] === fam);
    [a, b] = shuffle(pool).slice(0, 2);
  } else {
    const pairs = [['Ua','Ub'],['Ja','Jb'],['Aa','Ab'],['Ra','Rb'],['Na','Nb'],['G1','G2'],['H','Z'],['T','Y'],['V','F']];
    const pr = pick(pairs);
    a = DATA.PLL.find(x => x.name === pr[0]);
    b = DATA.PLL.find(x => x.name === pr[1]);
  }
  if (!a || !b) return;

  const wrap = el('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

  [a, b].forEach((it, i) => {
    const toks = parseNotation(it.notation);
    const cc = applyAlg(solvedCube(), invert(toks));
    const box = el('div');
    box.style.cssText = 'border:2px solid var(--line);border-radius:16px;padding:8px;background:#fff;';
    const nm = el('div','center');
    nm.style.cssText = 'font-weight:900;font-size:15px;margin-bottom:4px;color:' + (i ? 'var(--red)' : 'var(--blue)');
    nm.textContent = relateStageKey === 'PLL' ? it.name : (OLL_FAMILY[it.shape[0]] ? OLL_FAMILY[it.shape[0]].nick : '') + ' 第' + it.num + '式';
    box.appendChild(nm);

    const vw = el('div','viewwrap');
    const vd = el('div');
    vd.id = 'pair-' + i;
    vw.appendChild(vd);
    box.appendChild(vw);

    const chart = el('div');
    box.appendChild(chart);
    if (relateStageKey === 'PLL' && it.ring) buildChart(chart, { ring: it.ring }, { mode:'pll' });
    else if (it.pattern) chart.appendChild(ollThumb(it.pattern, 20));

    const code = el('div','mono center');
    code.style.cssText = 'font-size:11.5px;color:var(--sub);margin-top:6px;word-break:break-all;';
    code.textContent = it.notation;
    box.appendChild(code);

    host.appendChild(box);
    setTimeout(() => drawCube($('pair-' + i), cc, {}), 0);
  });

  const note = el('div','sub');
  note.style.cssText = 'margin-top:10px;text-align:center;';
  note.innerHTML = relateStageKey === 'PLL'
    ? '👆 两招都看<b>车灯在哪一面</b>。找到车灯位置，就知道该用左边还是右边。'
    : '👆 两招形状很像，差别在<b>黄色块的方向</b>。用手指点着屏幕，一处一处比。';
  host.appendChild(note);
}

/* ---------------- 成就 ---------------- */
const BADGES = [
  { id:'f2l10', e:'🌱', nm:'森林入门', cond:() => countDone('f2l') >= 10 },
  { id:'f2l41', e:'🌳', nm:'森林之王', cond:() => countDone('f2l') >= 41 },
  { id:'oll9',  e:'⛰️', nm:'登上山顶', cond:() => countDone('oll') >= 9 },
  { id:'oll57', e:'🏔️', nm:'山顶之王', cond:() => countDone('oll') >= 57 },
  { id:'pll6',  e:'🏰', nm:'走进城堡', cond:() => countDone('pll') >= 6 },
  { id:'pll21', e:'👑', nm:'城堡之王', cond:() => countDone('pll') >= 21 },
  { id:'streak3', e:'🔥', nm:'连练 3 天', cond:() => (store.streak||0) >= 3 },
  { id:'streak7', e:'🌟', nm:'连练 7 天', cond:() => (store.streak||0) >= 7 },
  { id:'sense',  e:'👀', nm:'火眼金睛', cond:() => (store.sense.stars||0) >= 2 },
  { id:'quest5', e:'⚔️', nm:'闯关小将', cond:() => Object.keys(store.quest).length >= 5 },
  { id:'win1',   e:'🥊', nm:'首胜', cond:() => (store.battle.w||0) >= 1 },
  { id:'win10',  e:'🏅', nm:'十连胜', cond:() => (store.battle.w||0) >= 10 }
];

function renderAch(){
  $('ach-stars').textContent = (totalStars() + starTotal()) + ' ⭐';
  $('ach-streak').textContent = store.streak || 0;

  const host = $('ach-badges');
  host.innerHTML = '';
  BADGES.forEach(b => {
    const ok = b.cond();
    const d = el('div','badge' + (ok ? ' un' : ' locked'));
    d.innerHTML = `<div class="e">${ok ? b.e : '🔒'}</div><div>${b.nm}</div>`;
    host.appendChild(d);
  });

  const log = $('ach-log');
  log.innerHTML = '';
  if (!store.log.length) log.innerHTML = '<div>还没有记录，去练一招吧！</div>';
  store.log.slice(0, 15).forEach(x => {
    const d = el('div');
    const dt = new Date(x.t);
    d.innerHTML = `<span>${x.txt}</span><span class="sub">${(dt.getMonth()+1)}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}</span>`;
    log.appendChild(d);
  });
}

function resetAll(){
  if (!confirm('确定要清空所有星星和闯关记录吗？')) return;
  store = { learned:{}, log:[], quest:{}, battle:{w:0,l:0,d:0}, sense:{}, streak:0, lastDay:null,
            skins:{ cube:'classic', comp:'classic' }, notes:{ streak:0, best:0 }, imagine:{ count:0 }, training:[], cloud:{ url:'', auto:false } };
  saveStore();
  refreshTopStars();
  renderHome();
  renderAch();
  toast('已清空');
}

/* ---------------- 训练数据 / 云端上传 ---------------- */
function fmtDateTime(t){
  const d = new Date(t);
  const p = n => String(n).padStart(2,'0');
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function kindName(k){
  return { practice:'实战复原', formula:'公式跟练', battle:'人机对战', scramble:'打乱练习', sensor:'整体朝向' }[k] || k;
}
function renderData(){
  store.training = store.training || [];
  /* 总览 */
  const t = store.training;
  const cnt = {};
  t.forEach(e => { cnt[e.kind] = (cnt[e.kind]||0) + 1; });
  const prac = t.filter(e => e.kind === 'practice');
  const avg = prac.length ? (prac.reduce((s,e)=>s+(e.secs||0),0)/prac.length) : 0;
  const best = prac.length ? Math.min.apply(null, prac.map(e=>e.secs)) : 0;
  $('data-summary').innerHTML =
    '共记录 <b>' + t.length + '</b> 条训练<br>' +
    '实战复原 <b>' + (cnt.practice||0) + '</b> 次 · 平均 <b>' + avg.toFixed(1) + '</b> 秒 · 最快 <b>' + best.toFixed(1) + '</b> 秒<br>' +
    '公式跟练 <b>' + (cnt.formula||0) + '</b> 次 · 打乱练习 <b>' + (cnt.scramble||0) + '</b> 次 · 对战 <b>' + (cnt.battle||0) + '</b> 次';

  /* 云端地址回填 */
  const urlIn = $('data-url');
  if (urlIn && store.cloud) urlIn.value = store.cloud.url || '';

  /* 记录列表 */
  const list = $('data-list');
  list.innerHTML = '';
  if (!t.length){ list.innerHTML = '<div>还没有训练记录，去实战或公式跟练试试。</div>'; }
  t.slice().reverse().slice(0, 40).forEach(e => {
    const d = el('div');
    let detail = '';
    if (e.kind === 'practice') detail = e.secs + ' 秒 / ' + e.moves + ' 步';
    else if (e.kind === 'formula') detail = (e.stage||'') + ' 第' + e.num + '式 · ' + (e.ok ? '完成✅' : '未完成') ;
    else if (e.kind === 'battle') detail = (e.win ? '胜' : '负') + ' · ' + (e.secs?e.secs+'秒/':'') + e.moves + '步 · 对手' + (e.opp||'');
    else if (e.kind === 'scramble') detail = (e.moves||'') + ' 步打乱 · ' + (e.by||'');
    else if (e.kind === 'sensor') detail = 'x' + (e.rot.x) + '° y' + (e.rot.y) + '° z' + (e.rot.z) + '°';
    d.innerHTML = `<span>${kindName(e.kind)}：${detail}</span><span class="sub">${fmtDateTime(e.t)}</span>`;
    list.appendChild(d);
  });

  /* 训练意见 */
  const adv = $('data-advice');
  const tips = [];
  if (!t.length) tips.push('还没有数据，多练几次实战复原，我就能给你针对性建议啦。');
  else {
    if (prac.length >= 2){
      if (best <= 15) tips.push('🚀 你已经能进 15 秒以内，F2L 的手感很稳，可以挑战更短的 OLL/PLL 公式。');
      else if (best <= 30) tips.push('👍 最快 ' + best.toFixed(1) + ' 秒，基础不错！想再快就练「两步 OLL（9 招）」和「两步 PLL（6 招）」，把顶层压缩到两步。');
      else tips.push('💪 最快 ' + best.toFixed(1) + ' 秒，先把层先法练熟，再慢慢引入 F2L，别急着背全部 119 招。');
    }
    const fm = t.filter(e => e.kind === 'formula');
    if (fm.length) tips.push('你已经跟练过 ' + fm.length + ' 次公式，继续保持，把每招都练到「不用想就能拧」就成肌肉记忆了。');
    if (cnt.scramble) tips.push('打乱练习做了 ' + cnt.scramble + ' 次，手感在积累，很好。');
  }
  adv.innerHTML = tips.map(x => '· ' + x).join('<br>');
}

function saveDataCloud(){
  store.cloud = store.cloud || {};
  const v = ($('data-url').value || '').trim();
  store.cloud.url = v;
  saveStore();
  $('data-cloud-msg').textContent = v ? '✅ 已保存上传地址。' : '已清空上传地址（只本地保存）。';
}
function uploadData(){
  const url = (store.cloud && store.cloud.url) || ($('data-url').value||'').trim();
  if (!url){ $('data-cloud-msg').textContent = '⚠️ 还没填上传地址。没有服务器也能「导出 JSON」先保存。'; return; }
  $('data-cloud-msg').textContent = '☁️ 正在上传…';
  const payload = { app:'cfop-kids', exportedAt: Date.now(), data: store.training };
  fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  }).then(r => {
    $('data-cloud-msg').textContent = r.ok ? '✅ 上传成功！' : ('⚠️ 服务器返回 ' + r.status + '，请检查接口。');
  }).catch(e => {
    $('data-cloud-msg').textContent = '⚠️ 上传失败：' + (e && e.message || e) + '（离线或地址不对？可改用导出 JSON）';
  });
}
function exportData(){
  const payload = { app:'cfop-kids', exportedAt: Date.now(), store: { training: store.training, learned: store.learned, battle: store.battle } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '魔方训练数据-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  toast('已导出 JSON');
}
function clearTraining(){
  if (!window.__clearArmed){
    window.__clearArmed = true;
    const b = document.querySelector('[onclick="clearTraining()"]');
    if (b) b.textContent = '⚠️ 再点一次确认清空';
    setTimeout(() => { window.__clearArmed = false; if (b) b.textContent = '清空'; }, 3000);
    return;
  }
  window.__clearArmed = false;
  store.training = [];
  saveStore();
  renderData();
  toast('已清空训练记录');
  const b = document.querySelector('[onclick="clearTraining()"]');
  if (b) b.textContent = '清空';
}
