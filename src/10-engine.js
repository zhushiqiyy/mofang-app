/* =========================================================================
   10-engine.js — 魔方几何引擎 + 视图渲染
   -------------------------------------------------------------------------
   几何部分已通过 119 公式"逆序还原必回原位"全量校验。
   视图部分：等距轴测 SVG（真 3D）+ 分离式平面视图（6 面各自独立）。
   ========================================================================= */

/* ---------------- 基础几何 ---------------- */
/* COLORS 必须是 let：皮肤直接覆盖这 6 个槽的颜色，全站所有魔方统一换色 */
let COLORS = { y:'#FFD500', r:'#E8121D', g:'#009E54', w:'#FFFFFF', o:'#FF6A00', b:'#0051BA' };
/* 当前魔方皮肤的特效类型（null = 无特效）。drawCube 据此在魔方背后加泡泡/星芒/流光等 */
let CUBE_FX = null;
const COLOR_NAME = { y:'黄', r:'红', g:'绿', w:'白', o:'橙', b:'蓝' };
const FACE_NAME = { U:'上', D:'下', F:'前', B:'后', R:'右', L:'左' };
const FACE_ORDER = ['U','D','F','B','R','L'];

/* 魔方皮肤 = 只换"特效"，六面基础颜色始终保留（经典六色）。
   贴纸一律用纯色填充（和分解图完全一致的配色）——对小朋友的眼睛更友好，
   也更容易认色；立体感来自几何投影与深色描边，不靠颜色渐变。
   每个特效含：glow(霓虹光晕色) / particles(背后粒子类型) / sheen(覆面扫光样式) */
const CUBE_EFFECTS = {
  flame:  { name:'烈焰红莲', desc:'向上跳动的余烬 + 暖光',            glow:'#ff5a1e', particles:'flame' },
  ocean:  { name:'深海蔚蓝', desc:'上浮的蓝气泡 + 水光',            glow:'#37b6ff', particles:'bubble' },
  forest: { name:'翡翠森林', desc:'绿光浮岛 + 星点闪烁',            glow:'#27c08a', particles:'leaf' },
  sun:    { name:'暖阳金辉', desc:'金色光晕 + 暖星',                glow:'#ffc24a', particles:'sun',    sheen:'sheen-gloss' },
  galaxy: { name:'星河紫梦', desc:'紫雾星海 + 彩虹全息',            glow:'#9a6bff', particles:'star',   sheen:'sheen-holo' },
  aurora: { name:'极光绚烂', desc:'流动极光带 + 流光',              glow:'#52ffc2', particles:'aurora', sheen:'sheen-holo' },
  bubble: { name:'泡泡糖',   desc:'彩色柔光泡泡',                  glow:'#ff9ecb', particles:'bubbleP' },
  brill:  { name:'流光彩钻', desc:'全息彩屑飘落',                  glow:'#7a5bff', particles:'confetti',sheen:'sheen-holo' }
};

const FACES = {
  U:{C:[0,0,1],  u:[1,0,0],  v:[0,1,0],  n:[0,0,1]},
  D:{C:[0,0,-1], u:[1,0,0],  v:[0,-1,0], n:[0,0,-1]},
  F:{C:[0,1,0],  u:[1,0,0],  v:[0,0,1],  n:[0,1,0]},
  B:{C:[0,-1,0], u:[-1,0,0], v:[0,0,1],  n:[0,-1,0]},
  R:{C:[1,0,0],  u:[0,-1,0], v:[0,0,1],  n:[1,0,0]},
  L:{C:[-1,0,0], u:[0,1,0],  v:[0,0,1],  n:[-1,0,0]}
};

function posOf(f, r, c){
  const o = FACES[f];
  return [
    o.C[0] + o.u[0]*(c-1) + o.v[0]*(1-r),
    o.C[1] + o.u[1]*(c-1) + o.v[1]*(1-r),
    o.C[2] + o.u[2]*(c-1) + o.v[2]*(1-r)
  ];
}
function nOf(f){ return FACES[f].n.slice(); }

function rot3(p, ax, deg){
  const a = deg*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
  const [x,y,z] = p;
  if (ax === 'x') return [x, c*y - s*z, s*y + c*z];
  if (ax === 'y') return [c*x + s*z, y, -s*x + c*z];
  return [c*x - s*y, s*x + c*y, z];
}

/* 整体旋转（手腕整转）：把魔方当刚体绕 x/y/z 各轴转若干度。
   仅作用于渲染（pracCube 的贴纸状态不变），用于「真魔方整转→屏幕整体跟着转」的联动。 */
function rotEuler(p, rx, ry, rz){
  let q = p;
  if (rz) q = rot3(q, 'z', rz);
  if (ry) q = rot3(q, 'y', ry);
  if (rx) q = rot3(q, 'x', rx);
  return q;
}

const MOVEDEF = {
  U:{axis:'z',vals:[1],ang:-90},   D:{axis:'z',vals:[-1],ang:90},
  R:{axis:'x',vals:[1],ang:-90},   L:{axis:'x',vals:[-1],ang:90},
  F:{axis:'y',vals:[1],ang:-90},   B:{axis:'y',vals:[-1],ang:90},
  M:{axis:'x',vals:[0],ang:90},    E:{axis:'z',vals:[0],ang:90},   S:{axis:'y',vals:[0],ang:-90},
  x:{axis:'x',vals:[-1,0,1],ang:-90}, y:{axis:'y',vals:[-1,0,1],ang:-90}, z:{axis:'z',vals:[-1,0,1],ang:-90},
  r:{axis:'x',vals:[1,0],ang:-90}, l:{axis:'x',vals:[-1,0],ang:90},
  f:{axis:'y',vals:[1,0],ang:-90}, b:{axis:'y',vals:[-1,0],ang:90},
  u:{axis:'z',vals:[1,0],ang:-90}, d:{axis:'z',vals:[-1,0],ang:90}
};

function moveOf(t){
  const d = MOVEDEF[t.f];
  let ang = d.ang;
  if (t.prime) ang = -ang;
  if (t.dbl)  ang = 180;
  return { axis:d.axis, vals:d.vals, ang };
}

function eqv(a, b){
  return Math.abs(a[0]-b[0]) < 1e-6 && Math.abs(a[1]-b[1]) < 1e-6 && Math.abs(a[2]-b[2]) < 1e-6;
}
function findDest(p, n){
  for (const f in FACES){
    for (let r=0;r<3;r++) for (let c=0;c<3;c++){
      if (eqv(posOf(f,r,c), p) && eqv(nOf(f), n)) return { face:f, r, c };
    }
  }
  return null;
}

/* 关键：中心贴纸永远不动（真实魔方六个中心固定） */
function applyMove(cube, mv){
  const next = JSON.parse(JSON.stringify(cube));
  const as = [];
  for (const f in FACES){
    for (let r=0;r<3;r++) for (let c=0;c<3;c++){
      if (r === 1 && c === 1) continue;
      const p = posOf(f,r,c);
      const coord = p[mv.axis === 'x' ? 0 : mv.axis === 'y' ? 1 : 2];
      if (!mv.vals.includes(Math.round(coord))) continue;
      const p2 = rot3(p, mv.axis, mv.ang);
      const n2 = rot3(nOf(f), mv.axis, mv.ang);
      const dest = findDest(p2, n2);
      if (!dest) return null;
      as.push({ dest, color: cube[f][r*3+c] });
    }
  }
  for (const a of as) next[a.dest.face][a.dest.r*3 + a.dest.c] = a.color;
  return next;
}

const MOVE_RE = /^([URDLFBurldfbmsexyzMSE])(['’]?)(2?)$/;
function parseNotation(str){
  return String(str).trim().split(/\s+/).filter(Boolean).map(tok => {
    const m = tok.match(MOVE_RE);
    if (!m) return null;
    return { f:m[1], prime:m[2].length > 0, dbl:m[3] === '2' };
  }).filter(Boolean);
}
function applyAlg(cube, toks){
  let c = cube;
  for (const t of toks){ c = applyMove(c, moveOf(t)); if (!c) return null; }
  return c;
}
const UP_COLOR = 'w';   /* 顶面色（白）。与校准文字/色板一致：U 上白、D 下黄。
                           OLL/PLL 的"顶面识别"一律按 UP_COLOR 判断，不再写死 'y'，
                           这样无论顶色是白还是黄，图案识别都不会全灰。 */
function solvedCube(){
  const f = c => new Array(9).fill(c);
  return { U:f(UP_COLOR), R:f('r'), F:f('g'), D:f('y'), L:f('o'), B:f('b') };
}
function invert(toks){
  return toks.slice().reverse().map(t => ({ f:t.f, prime:!t.prime, dbl:t.dbl }));
}
function isSolved(c){
  for (const f in c){
    const col = c[f][0];
    if (!c[f].every(x => x === col)) return false;
  }
  return true;
}
/* 统计已归位的块数（0..26），用于"差多少"提示 */
function solvedCubies(c){
  if (isSolved(c)) return 26;
  let n = 0;
  const done = solvedCube();
  for (const f in FACES){
    for (let r=0;r<3;r++) for (let c=0;c<3;c++){
      if (c[f][r*3+c] === done[f][r*3+c]) n++;
    }
  }
  return Math.round(n / 3);
}
function fmtMove(t){
  return t.f + (t.dbl ? '2' : t.prime ? "'" : '');
}
function algStr(toks){ return toks.map(fmtMove).join(' '); }

/* ---------------- 视图投影 ---------------- */
const VIEW = { yaw: Math.PI/4, pitch: Math.PI/6 };

/* 世界点 -> 视图空间 [屏幕右, 深度(大=更近), 屏幕上] */
function toView(p, yaw, pitch){
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = p[0]*ca - p[1]*sa;
  const y1 = p[0]*sa + p[1]*ca;
  const z1 = p[2];
  return [ x1, y1*cp + z1*sp, -y1*sp + z1*cp ];
}

/* -------------------------------------------------------------------------
   关键：魔方边长 3 个格子，表面在 ±1.5。
   posOf() 返回的是"块位坐标"（-1/0/1 的整数格），用于转动逻辑；
   画图必须用 surfOf() —— 面心推到 ±1.5，格心才落在 -1/0/1。
   以前两者混用，U 面画在 z=1、F 面画在 y=1，两个面互相插穿 = 穿模。
   ------------------------------------------------------------------------- */
const SURF = 1.5;
function surfOf(f, r, c){
  const o = FACES[f];
  return [
    o.C[0]*SURF + o.u[0]*(c-1) + o.v[0]*(1-r),
    o.C[1]*SURF + o.u[1]*(c-1) + o.v[1]*(1-r),
    o.C[2]*SURF + o.u[2]*(c-1) + o.v[2]*(1-r)
  ];
}

const STICKERS = (function(){
  const list = [];
  const H = 0.475;                      /* 格子半宽，留 0.05 的缝露出深色底板 */
  for (const f in FACES){
    for (let r=0;r<3;r++) for (let c=0;c<3;c++){
      const o = FACES[f];
      const p = surfOf(f,r,c);
      const cubie = posOf(f,r,c);       /* 该贴纸属于哪个块（-1/0/1 整数） */
      const cs = [
        [ p[0]+o.u[0]*H+o.v[0]*H, p[1]+o.u[1]*H+o.v[1]*H, p[2]+o.u[2]*H+o.v[2]*H ],
        [ p[0]-o.u[0]*H+o.v[0]*H, p[1]-o.u[1]*H+o.v[1]*H, p[2]-o.u[2]*H+o.v[2]*H ],
        [ p[0]-o.u[0]*H-o.v[0]*H, p[1]-o.u[1]*H-o.v[1]*H, p[2]-o.u[2]*H-o.v[2]*H ],
        [ p[0]+o.u[0]*H-o.v[0]*H, p[1]+o.u[1]*H-o.v[1]*H, p[2]+o.u[2]*H-o.v[2]*H ]
      ];
      list.push({ f, r, c, p, cubie, corners: cs, n:o.n.slice() });
    }
  }
  return list;
})();

/* 按"块"分组（27 块）。画的时候一块一块画，块内三张贴纸一起画，
   就绝不会出现两张面片互相插队、颜色片压到别的面上的情况。 */
const CUBIES = (function(){
  const map = new Map();
  for (let i=0;i<STICKERS.length;i++){
    const key = STICKERS[i].cubie.join(',');
    if (!map.has(key)) map.set(key, { pos: STICKERS[i].cubie.slice(), idx: [] });
    map.get(key).idx.push(i);
  }
  return Array.from(map.values());
})();

const SVGNS = 'http://www.w3.org/2000/svg';
let _cubeUid = 0;

/* 创建（或复用）一个 3D 视图容器 */
function cubeView(el){
  if (el._cv) return el._cv;
  el.innerHTML = '';
  const uid = ++_cubeUid;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('class', 'cube3d');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.appendChild(svg);

  /* 皮肤特效层（背后）：泡泡 / 星芒 / 光晕… */
  const fx = document.createElementNS(SVGNS, 'g');
  fx.setAttribute('class', 'cube-fx');

  /* 霓虹光晕层：魔方轮廓的模糊彩色描边，制造发光感 */
  const glow = document.createElementNS(SVGNS, 'g');
  glow.setAttribute('class', 'cube-glow');

  /* 深色底座：填充三个可见面的整体轮廓，缝隙露出深色（真魔方的塑料缝） */
  const base = document.createElementNS(SVGNS, 'g');

  /* 滤镜 defs：霓虹光晕的模糊滤镜（每个魔方独立 id，避免冲突） */
  const defs = document.createElementNS(SVGNS, 'defs');
  const filt = document.createElementNS(SVGNS, 'filter');
  filt.id = 'g' + uid + '-blur'; filt.setAttribute('x','-60%'); filt.setAttribute('y','-60%');
  filt.setAttribute('width','220%'); filt.setAttribute('height','220%');
  const fb = document.createElementNS(SVGNS, 'feGaussianBlur'); fb.setAttribute('stdDeviation','4.2'); filt.appendChild(fb);
  defs.appendChild(filt);
  svg.appendChild(defs);

  /* 扫光 defs：魔方轮廓 clipPath + 光泽光带渐变 + 全息彩带渐变 */
  const clip = document.createElementNS(SVGNS, 'clipPath'); clip.id = 'clip' + uid; defs.appendChild(clip);
  const gGloss = document.createElementNS(SVGNS, 'linearGradient');
  gGloss.id = 'sg' + uid; gGloss.setAttribute('x1','0'); gGloss.setAttribute('y1','0'); gGloss.setAttribute('x2','1'); gGloss.setAttribute('y2','0');
  [[0,0],[42,0],[50,0.6],[58,0],[100,0]].forEach(([o,op]) => {
    const s = document.createElementNS(SVGNS,'stop'); s.setAttribute('offset',o+'%'); s.setAttribute('stop-color','#ffffff'); s.setAttribute('stop-opacity',op); gGloss.appendChild(s);
  });
  defs.appendChild(gGloss);
  const gHolo = document.createElementNS(SVGNS, 'linearGradient');
  gHolo.id = 'sh' + uid; gHolo.setAttribute('x1','0'); gHolo.setAttribute('y1','0'); gHolo.setAttribute('x2','1'); gHolo.setAttribute('y2','0');
  ['#ff3d80','#ffd400','#00e5a0','#18b6ff','#7a5bff','#ff3d80'].forEach((c,i) => {
    const s = document.createElementNS(SVGNS,'stop'); s.setAttribute('offset',(i/5*100)+'%'); s.setAttribute('stop-color',c); s.setAttribute('stop-opacity','.55'); gHolo.appendChild(s);
  });
  defs.appendChild(gHolo);

  const polys = STICKERS.map(() => {
    const g = document.createElementNS(SVGNS, 'polygon');
    g.setAttribute('stroke-linejoin', 'round');
    return g;
  });

  /* 扫光组：一条光带，被魔方轮廓 clipPath 裁剪 → 像"光扫过魔方"，而不是整块方框 */
  const sheen = document.createElementNS(SVGNS, 'g');
  sheen.setAttribute('class', 'cube-sheen');
  sheen.setAttribute('clip-path', 'url(#clip' + uid + ')');
  const sheenBand = document.createElementNS(SVGNS, 'rect');
  sheenBand.setAttribute('x', '-300'); sheenBand.setAttribute('y', '-60');
  sheenBand.setAttribute('width', '900'); sheenBand.setAttribute('height', '420');
  sheenBand.setAttribute('class', 'sheen-band');
  sheenBand.setAttribute('style', 'display:none');
  sheen.appendChild(sheenBand);

  /* 顺序：fx(背) → glow(光晕) → base(暗底) → polys(贴纸) → sheen(扫光) → marks(高亮) */
  svg.appendChild(fx);
  svg.appendChild(glow);
  svg.appendChild(base);
  polys.forEach(p => svg.appendChild(p));
  svg.appendChild(sheen);
  const marks = document.createElementNS(SVGNS, 'g');
  svg.appendChild(marks);

  const cv = { uid, el, svg, polys, marks, base, fx, glow, sheen, sheenClip: clip, sheenBand, yaw: VIEW.yaw, pitch: VIEW.pitch, scale: 1, _fxKey: undefined, lastCube: undefined, lastOpt: {} };

  /* 拖动改变视角 */
  let dragging = false, lx = 0, ly = 0;
  svg.addEventListener('pointerdown', e => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging) return;
    cv.yaw   += (e.clientX - lx) * 0.012;
    cv.pitch  = Math.max(-1.15, Math.min(1.30, cv.pitch + (e.clientY - ly) * 0.010));
    lx = e.clientX; ly = e.clientY;
    drawCube(el, cv.lastCube || solvedCube(), cv.lastOpt || {});
  });
  const stop = () => { dragging = false; };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
  svg.addEventListener('pointerleave', stop);

  /* 让扫光层能相对魔方定位 */
  el.style.position = el.style.position || 'relative';
  el.style.overflow = el.style.overflow || 'hidden';

  el._cv = cv;
  return cv;
}

/* 主绘制
   opt: { hl:[{pos:[x,y,z], color, label}], dim:bool, move:{axis,ang,vals}, showAxis }
*/
function drawCube(el, cube, opt){
  opt = opt || {};
  const cv = cubeView(el);
  cv.lastCube = cube;
  cv.lastOpt  = opt;

  const yaw = (opt.yaw !== undefined) ? opt.yaw : cv.yaw;
  const pitch = (opt.pitch !== undefined) ? opt.pitch : cv.pitch;
  const W = 300, cx = 150, cy = 150, S = 56;

  const mv = opt.move || null;
  const hlList = opt.hl || [];
  const hlPos = hlList.map(h => h.pos.join(','));
  const dimSet = opt.dimFaces || null;

  /* 整体旋转（真魔方手腕整转联动）：把整魔方当刚体转。仅改渲染，不改贴纸状态。 */
  const R = opt.cubeRot;
  const rot = (p) => R ? rotEuler(p, R.x || 0, R.y || 0, R.z || 0) : p;

  /* 全部先藏起来，再按可见性打开（避免上一帧的残留） */
  for (let i=0;i<cv.polys.length;i++) cv.polys[i].style.display = 'none';

  /* --- 每块算：要不要转（动画层）、投影、深度 --- */
  const groups = [];
  for (const g of CUBIES){
    const key = g.pos.join(',');
    const inLayer = !!mv && mv.vals.includes(Math.round(g.pos[mv.axis === 'x' ? 0 : mv.axis === 'y' ? 1 : 2]));
    const angled  = inLayer ? mv.ang : 0;
    const items = [];

    for (const i of g.idx){
      const st = STICKERS[i];
      let corners = st.corners;
      let normal  = st.n;
      if (angled){
        corners = corners.map(p => rot3(p, mv.axis, angled));
        normal  = rot3(st.n, mv.axis, angled);
      }
      corners = corners.map(rot);          /* 叠加整体旋转（手腕整转联动） */
      normal  = rot(normal);
      const nv = toView(normal, yaw, pitch);
      if (nv[1] <= 0.002) continue;                 /* 背向镜头 → 不画 */
      const pts = corners.map(p => {
        const v = toView(p, yaw, pitch);
        return [ cx + v[0]*S, cy - v[2]*S ];
      });
      items.push({ i, pts, color: cube[st.f][st.r*3+st.c], f: st.f });
    }
    if (!items.length) continue;

    const depth = toView(rot(g.pos), yaw, pitch)[1];
    groups.push({ items, depth, key, hlIdx: hlPos.indexOf(key) });
  }

  /* 块与块之间按深度从远到近画（画家算法） */
  groups.sort((a,b) => a.depth - b.depth);

  /* --- 深色底板 + 霓虹光晕 + 扫光裁剪轮廓（共用同一组轮廓） --- */
  while (cv.base.firstChild) cv.base.removeChild(cv.base.firstChild);
  while (cv.glow.firstChild) cv.glow.removeChild(cv.glow.firstChild);
  while (cv.sheenClip.firstChild) cv.sheenClip.removeChild(cv.sheenClip.firstChild);
  const fxDef = CUBE_EFFECTS[CUBE_FX] || null;
  for (const f in FACES){
    const o = FACES[f];
    const C2 = rot(o.C), u2 = rot(o.u), v2 = rot(o.v), n2 = rot(o.n);
    const nv = toView(n2, yaw, pitch);
    if (nv[1] <= 0.001) continue;
    const quad = [[1,1],[-1,1],[-1,-1],[1,-1]].map(([a,b]) => {
      const p3 = [
        C2[0]*SURF + u2[0]*1.53*a + v2[0]*1.53*b,
        C2[1]*SURF + u2[1]*1.53*a + v2[1]*1.53*b,
        C2[2]*SURF + u2[2]*1.53*a + v2[2]*1.53*b
      ];
      const v = toView(p3, yaw, pitch);
      return (cx + v[0]*S).toFixed(2) + ',' + (cy - v[2]*S).toFixed(2);
    }).join(' ');
    const poly = document.createElementNS(SVGNS, 'polygon');
    poly.setAttribute('points', quad);
    poly.setAttribute('fill', '#20293a');
    poly.setAttribute('stroke', '#20293a');
    poly.setAttribute('stroke-width', '2');
    cv.base.appendChild(poly);
    const cp = document.createElementNS(SVGNS, 'polygon');   /* 扫光裁剪用同一轮廓 */
    cp.setAttribute('points', quad);
    cv.sheenClip.appendChild(cp);
    if (fxDef && fxDef.glow){          /* 轮廓的模糊彩色描边 = 发光感 */
      const gp = document.createElementNS(SVGNS, 'polygon');
      gp.setAttribute('points', quad);
      gp.setAttribute('fill', fxDef.glow);
      gp.setAttribute('filter', 'url(#g' + cv.uid + '-blur)');
      gp.setAttribute('opacity', '0.9');
      cv.glow.appendChild(gp);
    }
  }

  /* 贴纸：纯色填充（与分解图完全一致的配色），深色描边分出块面 */
  const pal = COLORS;   /* 皮肤只换特效，不改这 6 个槽的颜色 */
  for (const grp of groups){
    for (const it of grp.items){
      const node = cv.polys[it.i];
      node.style.display = '';
      node.setAttribute('points', it.pts.map(p => p[0].toFixed(2)+','+p[1].toFixed(2)).join(' '));
      node.setAttribute('fill', pal[it.color] || '#999');
      node.setAttribute('stroke', '#10151f');
      node.setAttribute('stroke-width', '1.1');
      node.setAttribute('opacity', (dimSet && dimSet.indexOf(it.f) >= 0) ? '0.25' : '1');
      if (opt.dim && !hlPos.length) node.setAttribute('opacity','0.45');
      cv.svg.appendChild(node);   /* 重排 = 深度排序 */
    }
  }

  /* 高亮标记 */
  while (cv.marks.firstChild) cv.marks.removeChild(cv.marks.firstChild);

  if (hlList.length){
    const PALETTE = ['#ff2d55','#0a84ff','#ff9f0a','#30d158','#bf5af2'];
    /* 每个被高亮的块，用它自己那一眼的颜色描边 */
    for (const grp of groups){
      if (grp.hlIdx < 0) continue;
      const col = hlList[grp.hlIdx].color || PALETTE[grp.hlIdx % PALETTE.length];
      for (const it of grp.items){
        const node = cv.polys[it.i];
        node.setAttribute('stroke', col);
        node.setAttribute('stroke-width', '4');
      }
    }
    hlList.forEach((h, idx) => {
      const col = h.color || PALETTE[idx % PALETTE.length];
      const [ hx, hy, hz ] = h.pos;
      /* 标签圆点放在该块中心投影处（乘 1.55 贴到表面外） */
      const v = toView(rot([hx*1.55, hy*1.55, hz*1.55]), yaw, pitch);
      const px = cx + v[0]*S, py = cy - v[2]*S;

      /* ring：在格子外面套一圈（深色描边+白环），任何贴纸颜色上都看得清 */
      if (h.ring){
        const rr = h.r || 62;
        const halo = document.createElementNS(SVGNS, 'circle');
        halo.setAttribute('cx', px); halo.setAttribute('cy', py); halo.setAttribute('r', rr);
        halo.setAttribute('fill', 'none');
        halo.setAttribute('stroke', '#1b2436'); halo.setAttribute('stroke-width', 13);
        halo.setAttribute('opacity', '.92');
        cv.marks.appendChild(halo);
        const ring = document.createElementNS(SVGNS, 'circle');
        ring.setAttribute('cx', px); ring.setAttribute('cy', py); ring.setAttribute('r', rr);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', col); ring.setAttribute('stroke-width', 7);
        ring.setAttribute('class', 'pulse');
        cv.marks.appendChild(ring);
      }

      if (h.label){
        const rr = h.labelR || 13;
        const circ = document.createElementNS(SVGNS, 'circle');
        circ.setAttribute('cx', px); circ.setAttribute('cy', py); circ.setAttribute('r', rr);
        circ.setAttribute('fill', col); circ.setAttribute('stroke', '#fff'); circ.setAttribute('stroke-width', '3');
        cv.marks.appendChild(circ);
        const tx = document.createElementNS(SVGNS, 'text');
        tx.setAttribute('x', px); tx.setAttribute('y', py + rr*0.38);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('font-size', String(Math.round(rr*1.25))); tx.setAttribute('font-weight', '900');
        tx.setAttribute('fill', '#fff');
        tx.textContent = h.label;
        cv.marks.appendChild(tx);
      }
    });
  }

  /* 中心点小标记，帮孩子确认"中心永远不动" */
  if (opt.showCenters){
    for (const f of ['U','F','R']){
      const v = toView(rot([FACES[f].n[0]*1.55, FACES[f].n[1]*1.55, FACES[f].n[2]*1.55]), yaw, pitch);
      if (v[1] <= 0) continue;
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', cx + v[0]*S); t.setAttribute('y', cy - v[2]*S + 4);
      t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','13');
      t.setAttribute('font-weight','900'); t.setAttribute('fill','#1f2a3d');
      t.textContent = FACE_NAME[f];
      cv.marks.appendChild(t);
    }
  }
  /* 皮肤特效：仅在 CUBE_FX 变化（换皮肤 / 换页）时重建一次，动画期间不重画省性能 */
  if (cv._fxKey !== (CUBE_FX || '')){
    cv._fxKey = (CUBE_FX || '');
    while (cv.fx.firstChild) cv.fx.removeChild(cv.fx.firstChild);
    if (CUBE_FX) cubeFxBuild(cv.fx, CUBE_FX);
  }

  /* 覆面扫光（全息彩带 / 光泽光带），被魔方轮廓裁剪，叠在贴纸上方 */
  {
    const sh = CUBE_EFFECTS[CUBE_FX];
    if (sh && sh.sheen === 'sheen-gloss'){
      cv.sheenBand.setAttribute('fill', 'url(#sg' + cv.uid + ')');
      cv.sheenBand.setAttribute('class', 'sheen-band sheen-band-gloss');
      cv.sheenBand.setAttribute('style', '');
    } else if (sh && sh.sheen === 'sheen-holo'){
      cv.sheenBand.setAttribute('fill', 'url(#sh' + cv.uid + ')');
      cv.sheenBand.setAttribute('class', 'sheen-band sheen-band-holo');
      cv.sheenBand.setAttribute('style', '');
    } else {
      cv.sheenBand.setAttribute('class', 'sheen-band');
      cv.sheenBand.setAttribute('style', 'display:none');
    }
  }

  /* 保证高亮标记永远在最上层 */
  cv.svg.appendChild(cv.marks);
  return cv;
}

/* 根据特效类型，在魔方背后的 fx 层生成装饰（泡泡 / 星芒 / 流光 / 余烬…）。
   粒子用真实模糊滤镜（g{uid}-blur）做柔光，比纯色圆点"好看"很多。
   动画全靠 01-head.html 里的 CSS keyframes。 */
function cubeFxBuild(g, fx){
  const A = SVGNS;
  const svg = g.ownerSVGElement;
  const blurId = (svg && svg.querySelector('filter')) ? svg.querySelector('filter').id : null;
  const BL = blurId ? ('filter:url(#' + blurId + ')') : '';
  const circ = (cx,cy,r,fill,cls,delay,extra) => {
    const c = document.createElementNS(A, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', fill); c.setAttribute('class', 'fx ' + cls);
    if (extra) c.setAttribute('style', extra);
    if (delay) c.style.animationDelay = delay;
    g.appendChild(c);
  };
  const ring = (cx,cy,r,stroke,cls,delay) => {
    const c = document.createElementNS(A, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', '2.4');
    c.setAttribute('class', 'fx ' + cls);
    if (delay) c.style.animationDelay = delay;
    g.appendChild(c);
  };
  const glowBlob = (cx,cy,r,fill) => {
    const c = document.createElementNS(A, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', fill); c.setAttribute('style', BL); c.setAttribute('class', 'fx');
    g.appendChild(c);
  };
  const star = (cx,cy,r,fill,delay) => {
    const k = r*0.26;
    const d = 'M'+cx+' '+(cy-r)+' L'+(cx+k)+' '+(cy-k)+' L'+(cx+r)+' '+cy+' L'+(cx+k)+' '+(cy+k)
            + ' L'+cx+' '+(cy+r)+' L'+(cx-k)+' '+(cy+k)+' L'+(cx-r)+' '+cy+' L'+(cx-k)+' '+(cy-k)+' Z';
    const p = document.createElementNS(A, 'path');
    p.setAttribute('d', d); p.setAttribute('fill', fill); p.setAttribute('class', 'fx fx-twinkle');
    if (delay) p.style.animationDelay = delay;
    g.appendChild(p);
  };
  const ribbon = (cx,cy,rx,ry,fill,rot,delay) => {
    const e = document.createElementNS(A, 'ellipse');
    e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('rx', rx); e.setAttribute('ry', ry);
    e.setAttribute('fill', fill); e.setAttribute('class', 'fx fx-aurora');
    e.setAttribute('style', BL);
    e.setAttribute('transform', 'rotate(' + rot + ' ' + cx + ' ' + cy + ')');
    if (delay) e.style.animationDelay = delay;
    g.appendChild(e);
  };
  const conf = (cx,cy,s,fill,rot,delay) => {
    const r = document.createElementNS(A, 'rect');
    r.setAttribute('x', cx-s/2); r.setAttribute('y', cy-s/2); r.setAttribute('width', s); r.setAttribute('height', s*0.62);
    r.setAttribute('rx', 1.5); r.setAttribute('fill', fill); r.setAttribute('class', 'fx fx-fall');
    r.setAttribute('transform', 'rotate(' + rot + ' ' + cx + ' ' + cy + ')');
    if (delay) r.style.animationDelay = delay;
    g.appendChild(r);
  };
  const ray = (cx,cy,len,ang,col) => {
    const r = document.createElementNS(A, 'line');
    const x2 = cx + Math.cos(ang)*len, y2 = cy + Math.sin(ang)*len;
    r.setAttribute('x1', cx); r.setAttribute('y1', cy); r.setAttribute('x2', x2); r.setAttribute('y2', y2);
    r.setAttribute('stroke', col); r.setAttribute('stroke-width', '3'); r.setAttribute('stroke-linecap', 'round');
    r.setAttribute('class', 'fx fx-twinkle'); r.setAttribute('style', BL);
    g.appendChild(r);
  };

  switch (CUBE_EFFECTS[fx] ? CUBE_EFFECTS[fx].particles : fx){
    case 'flame':   /* 烈焰：暖光 + 向上飘的余烬 */
      glowBlob(150,150,86,'rgba(255,120,30,.16)');
      [[60,256,5,'#ff3d00'],[105,262,4,'#ffb300'],[155,258,6,'#ff5a1e'],[205,260,4,'#ffd24a'],[250,252,5,'#ff7a00']].forEach((p,i)=>circ(p[0],p[1],p[2],p[3],'fx-rise',(i*0.4)+'s'));
      break;
    case 'bubble':  /* 深海：蓝调气泡上升（柔光圆环） */
      glowBlob(150,150,84,'rgba(120,190,255,.16)');
      [[44,206,7],[95,246,5],[150,256,6],[205,248,7],[258,204,8],[40,150,6],[266,150,7]].forEach((p,i)=>ring(p[0],p[1],p[2],'rgba(190,228,255,.7)','fx-bubble',(i*0.45)+'s'));
      break;
    case 'bubbleP': /* 泡泡糖：彩色柔光泡泡 */
      glowBlob(150,150,84,'rgba(255,255,255,.12)');
      const pc = ['#FFE066','#FF8FA3','#8AE0C2','#8AB6FF','#FFB085','#C7A3FF'];
      [[46,210,7],[98,248,6],[150,256,7],[204,250,6],[256,206,8],[40,150,6],[266,150,7]].forEach((p,i)=>circ(p[0],p[1],p[2],pc[i%pc.length],'fx-bubble',(i*0.4)+'s'));
      break;
    case 'leaf':    /* 翡翠森林：绿光浮岛 + 星点 */
      glowBlob(150,150,84,'rgba(40,200,120,.16)');
      [[50,60,4,'#16c079'],[250,70,4,'#5ee0a0'],[60,250,5,'#7CFC00'],[255,245,5,'#16c079'],[150,34,4,'#5ee0a0'],[35,150,4,'#7CFC00'],[270,150,4,'#16c079'],[150,266,5,'#5ee0a0']].forEach((p,i)=>star(p[0],p[1],p[2],p[3],(i*0.22)+'s'));
      break;
    case 'sun':     /* 暖阳金辉：金色光晕 + 光芒 + 暖星 */
      glowBlob(150,150,90,'rgba(255,200,60,.22)');
      for (let i=0;i<12;i++) ray(150,150,72,i*Math.PI/6,'rgba(255,210,90,.55)');
      [[150,40,5],[40,150,5],[260,150,5],[150,260,5],[60,60,4],[240,60,4],[60,240,4],[240,240,4]].forEach((p,i)=>star(p[0],p[1],p[2],'#ffe082',(i*0.2)+'s'));
      break;
    case 'star':    /* 星河紫梦：紫雾 + 闪烁星 */
      glowBlob(150,150,86,'rgba(120,90,200,.18)');
      const sc = ['#ffffff','#fff3a0','#c7b3ff'];
      [[60,55,4,'#ffffff'],[255,60,4,'#fff3a0'],[55,250,5,'#c7b3ff'],[255,245,5,'#ffffff'],[150,32,4,'#fff3a0'],[35,150,4,'#c7b3ff'],[265,150,4,'#ffffff'],[110,265,4,'#fff3a0'],[200,265,4,'#c7b3ff']].forEach((p,i)=>star(p[0],p[1],p[2],p[3],(i*0.2)+'s'));
      break;
    case 'aurora':  /* 极光：飘动的极光带 */
      ribbon(150,120,72,17,'rgba(82,255,194,.45)',-12,'0s');
      ribbon(120,150,62,15,'rgba(199,125,255,.42)',8,'0.8s');
      ribbon(182,176,66,15,'rgba(72,191,227,.42)',-6,'1.6s');
      break;
    case 'confetti':/* 流光彩钻：彩色碎片飘落 */
      glowBlob(150,150,84,'rgba(122,91,255,.14)');
      const cc = ['#FFE600','#FF2D55','#00E5A0','#5A4BFF','#FF8A00','#18FFFF'];
      [[40,50,9,'#FFE600',20],[90,40,8,'#FF2D55',-30],[150,60,9,'#00E5A0',10],[210,42,8,'#5A4BFF',40],[265,55,9,'#FF8A00',-15],[35,110,8,'#18FFFF',25],[270,110,9,'#FFE600',-20],[60,200,9,'#FF2D55',30],[150,250,10,'#00E5A0',15],[240,200,9,'#5A4BFF',-25],[110,260,9,'#FF8A00',20],[200,260,10,'#18FFFF',-10]].forEach((p,i)=>conf(p[0],p[1],p[2],p[3],p[4],(i*0.18)+'s'));
      break;
  }
}

/* 视角控制按钮组 */
function mountViewCtrl(host, getEl){
  host.innerHTML = '';
  const mk = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    host.appendChild(b);
  };
  mk('↺ 视角左转', () => { const cv = cubeView(getEl()); cv.yaw -= Math.PI/4; drawCube(getEl(), cv.lastCube||solvedCube(), cv.lastOpt||{}); });
  mk('↻ 视角右转', () => { const cv = cubeView(getEl()); cv.yaw += Math.PI/4; drawCube(getEl(), cv.lastCube||solvedCube(), cv.lastOpt||{}); });
  mk('⬆ 看得更上', () => { const cv = cubeView(getEl()); cv.pitch = Math.min(1.25, cv.pitch + 0.22); drawCube(getEl(), cv.lastCube||solvedCube(), cv.lastOpt||{}); });
  mk('⟲ 复位视角', () => { const cv = cubeView(getEl()); cv.yaw = Math.PI/4; cv.pitch = Math.PI/6; drawCube(getEl(), cv.lastCube||solvedCube(), cv.lastOpt||{}); });
}

/* 播放一段算法动画
   opts: { from: cube 起始状态, toks:[...], speed:1, onStep(i), onDone(cube), opt:{} }
*/
function animateAlg(el, fromCube, toks, opts){
  opts = opts || {};
  const base = fromCube || solvedCube();
  const per  = Math.max(90, 320 / (opts.speed || 1));
  let idx = 0;
  let cube = base;
  let raf = null, cancelled = false;

  function stepMove(){
    if (cancelled) return;
    if (idx >= toks.length){
      drawCube(el, cube, opts.opt || {});
      if (opts.onDone) opts.onDone(cube);
      return;
    }
    const t = toks[idx];
    const m = moveOf(t);
    const t0 = performance.now();

    (function frame(now){
      if (cancelled) return;
      const k = Math.min(1, (now - t0) / per);
      const e = k < 1 ? (1 - Math.pow(1 - k, 3)) : 1;   /* easeOutCubic */
      drawCube(el, cube, Object.assign({}, opts.opt || {}, {
        move: { axis:m.axis, ang:m.ang * e, vals:m.vals }
      }));
      if (k < 1){ raf = requestAnimationFrame(frame); }
      else {
        cube = applyMove(cube, m) || cube;
        idx++;
        if (opts.onStep) opts.onStep(idx - 1, cube);
        raf = requestAnimationFrame(stepMove);
      }
    })(t0);
  }
  raf = requestAnimationFrame(stepMove);

  return { cancel(){ cancelled = true; if (raf) cancelAnimationFrame(raf); } };
}

/* ---------------- 平面视图：6 个独立面 ---------------- */
function buildPlanar(host, cube, opt){
  opt = opt || {};
  host.innerHTML = '';
  for (const f of FACE_ORDER){
    const box = document.createElement('div');
    box.className = 'pface';
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.innerHTML = FACE_NAME[f] + ' ' + f + ' <em>' + COLOR_NAME[cube[f][4]] + '心</em>';
    box.appendChild(lb);
    const g = document.createElement('div');
    g.className = 'facegrid';
    for (let i=0;i<9;i++){
      const cell = document.createElement('i');
      cell.style.background = COLORS[cube[f][i]];
      if (opt.mark && opt.mark[f] && opt.mark[f].indexOf(i) < 0) cell.className = 'dim';
      g.appendChild(cell);
    }
    box.appendChild(g);
    host.appendChild(box);
  }
}

/* ---------------- 识别图：顶面 + 四侧条 ----------------
   布局（俯视）：
        [ 后 B ]
   [左L] [顶面U] [右R]
        [ 前 F ]
   方向校正（关键，否则"车灯"位置会看错）：
     F 条 左→右 = c0,c1,c2
     B 条 左→右 = c2,c1,c0   （俯视时 B 面在远端，其 c0 靠右）
     L 条 上→下 = c0,c1,c2
     R 条 上→下 = c2,c1,c0   （R 面 c0 靠近前，故在下方）
*/
function buildChart(host, src, opt){
  opt = opt || {};
  host.innerHTML = '';
  const chart = document.createElement('div');
  chart.className = 'chart';

  /* 取数据：优先用 ring，其次用 cube */
  let ring;
  if (src.ring) ring = src.ring;
  else {
    ring = { U: src.U.slice() };
    for (const f of ['F','R','B','L']){
      ring[f] = [ src[f][0], src[f][1], src[f][2] ];
    }
  }

  const seqF = [0,1,2];
  const seqB = [2,1,0];
  const seqL = [0,1,2];
  const seqR = [2,1,0];

  const mk = (color) => {
    const d = document.createElement('div');
    d.className = 'cellbox';
    d.style.background = color;
    return d;
  };
  const empty = () => { const d = document.createElement('div'); d.className = 'corner'; return d; };

  /* 后条（水平） */
  const bStrip = document.createElement('div');
  bStrip.className = 'strip h';
  seqB.forEach(c => bStrip.appendChild(mk(COLORS[ring.B[c]])));

  /* 左条（垂直） */
  const lStrip = document.createElement('div');
  lStrip.className = 'strip v';
  seqL.forEach(c => lStrip.appendChild(mk(COLORS[ring.L[c]])));

  /* 顶面 */
  const uFace = document.createElement('div');
  uFace.className = 'c3';
  for (let i=0;i<9;i++){
    const col = ring.U[i];
    if (opt.mode === 'oll'){
      uFace.appendChild(mkPure(col === UP_COLOR ? COLORS[UP_COLOR] : '#d9e0ee'));
    } else {
      uFace.appendChild(mk(COLORS[col]));
    }
  }

  /* 右条 */
  const rStrip = document.createElement('div');
  rStrip.className = 'strip v';
  seqR.forEach(c => rStrip.appendChild(mk(COLORS[ring.R[c]])));

  /* 前条 */
  const fStrip = document.createElement('div');
  fStrip.className = 'strip h';
  seqF.forEach(c => fStrip.appendChild(mk(COLORS[ring.F[c]])));

  chart.appendChild(empty());     chart.appendChild(bStrip); chart.appendChild(empty());
  chart.appendChild(lStrip);      chart.appendChild(uFace);  chart.appendChild(rStrip);
  chart.appendChild(empty());     chart.appendChild(fStrip); chart.appendChild(empty());
  host.appendChild(chart);

  /* 车灯检测：相邻两个角同色 */
  if (opt.mode !== 'oll'){
    const lights = [];
    if (ring.F[0] === ring.F[2]) lights.push('前');
    if (ring.B[0] === ring.B[2]) lights.push('后');
    if (ring.L[0] === ring.L[2]) lights.push('左');
    if (ring.R[0] === ring.R[2]) lights.push('右');
    const lab = document.createElement('div');
    lab.className = 'chart-label';
    lab.textContent = lights.length
      ? '💡 车灯：' + lights.join('、') + (lights.length > 1 ? '（两个面同色）' : '（一个面同色）')
      : '💡 没有车灯（相邻角块颜色都不同）';
    host.appendChild(lab);
  }
  if (opt.mode === 'oll'){
    const lab = document.createElement('div');
    lab.className = 'chart-label';
    lab.textContent = '白色 = 顶面已经翻上来的块 · 灰色 = 还没翻上来';
    host.appendChild(lab);
  }
  return chart;
}

function mkPure(color){
  const d = document.createElement('div');
  d.className = 'cellbox';
  d.style.background = color;
  return d;
}

/* 小尺寸 OLL 图案（用于卡片） */
function ollThumb(pattern, cell){
  cell = cell || 13;
  const g = document.createElement('div');
  g.style.cssText = 'display:grid;grid-template-columns:repeat(3,'+cell+'px);gap:2px;margin:4px auto 2px;width:max-content;';
  pattern.forEach(v => {
    const d = document.createElement('div');
    d.style.cssText = 'width:'+cell+'px;height:'+cell+'px;border-radius:2px;background:'+(v ? COLORS[UP_COLOR] : '#d9e0ee')+';';
    g.appendChild(d);
  });
  return g;
}

/* ---------------- 小工具 ---------------- */
function $(id){ return document.getElementById(id); }
function el(tag, cls, html){
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}
function shuffle(a){
  const r = a.slice();
  for (let i=r.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [r[i],r[j]] = [r[j],r[i]]; }
  return r;
}
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

let toastTimer = null;
function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}
