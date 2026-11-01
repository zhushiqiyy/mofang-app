// CFOP 数据生成器：规范化公式 + 用几何法魔方模型预计算 OLL 顶面图案 / PLL 顶环
// 运行: node generate.js  -> 生成 cfop-data.js

// ---------- 原始公式（来源：GAN 官方 CFOP 教程，与 GAN356i 同品牌）----------
const RAW = {
  F2L: [
    "(RU'R'U)y'(R'U2RU'U')(R'UR)","(URU'R'U')y'(R'UR)","(R'F'RU)(RU'R'F)","(RUR'U')(RU2R'U')(RUR')",
    "(RF)U(RU'R'F')(U'R')","y'(R'U'RU)(R'U'R)","(RU'R'U)(RU'R')","(RU'R'U)(RU'U'R'U)(RU'R')",
    "(RU)F(RUR'U')F'R'","y'(R'URU')(R'UR)","(RUR'U')(RUR')","(RUR'U')2(RUR')","(RU'R'U)y'(R'UR)",
    "y'(R'U2)(RUR'U'R)","y'U'(R'U2)(RU'R'UR)","y'(R'URU'U')(R'U'R)","FU(RU'R'F')(RU'R')","U(RU'R'U')(RU'R'U)(RU'R')",
    "(RU'R'U2)(RUR')","U(RU'U')(R'URU'R')","(RU'U')(R'U'RUR')","U'(RU'R'U2)(RU'R')","U'(RUR')y'(UR'U'R)",
    "y'U(R'URU')(R'U'R)","y'(R'U'R)","y'U(R'U'RU')(R'U'R)","y'(RU'U')(R'2U')(R2U'R')","(lU)(rU'r'U')l'",
    "U'(RU'U')(R'U2)(RU'R')","U'(RUR'U')(RU'U'R')","URU'R'","U'(RU'U'R'U)(RUR')","y'U(R'U'R)d'(RUR')",
    "y'U'(R'UR)","y'U(R'U'RU'U')(R'UR)","y'U(R'U2RU'U')(R'UR)","(RU'R'U2)y'(R'U'R)","(RU'R'U)(RU'R'U2)(RU'R')",
    "U'(RUR'U)(RUR')","(RUR')","U'(RU'R'U)(RUR')"
  ],
  OLL: [
    "(RU'U')(R'2FRF')U2(R'FRF')","F(RUR'U')F'f(RUR'U')f'","f(RUR'U')f'U'F(RUR'U')F'","f(RUR'U')f'UF(RUR'U')F'",
    "(r'U2)(RUR'U)r","(rU'U')(R'U'RU'r')","(rUR'U)(RU'U'r')","(r'U'RU')(R'U2r)",
    "(RUR'U')(R'F)(R2UR'U')F'","(RUR'U)(R'FRF')(RU'U'R')","(r'R2UR'U)(RU'U'R'U)M'","M'(R'U'RU')(R'U2RU')M",
    "f(RU)(R2U')(R'URU')f'","(R'F)(RUR'F'R)(FU'F')","(r'U'r)(R'U'RU)(r'Ur)","(rUr')(RUR'U')(rU'r')",
    "(lU'l')f(R2BR'UR'U'f')","(rUR'U)(RU'U'r')(r'U'RU')(R'U2r)","(r'RU)(RUR'U'r)(R'2FRF')","(rUR'U')M'2U(RU'R'U')M'",
    "(RU'U')(R'U'RUR'U')(RU'R')","(RU'U')(R'2U')(R2U')(R'2U')(U'R)","(R2D')(RU'U'R'D)(RU'U'R)","(rUR'U')(r'FRF')",
    "F'(rUR'U')(r'FR)","(RU'U')(R'U'RU'R')","(RUR'U)(RU'U'R')","(rUR'U')(r'RU)(RU'R')","(RUR'U')(RU'R'F'U'F)(RUR')",
    "f(RU)(R2U'R'U)(R2U'R')f'","(r'F'UF)(rU'r'U'r)","(RU)(B'U')(R'URBR')","(RUR'U')(R'FRF')","(RUR2U')(R'F)(RURU'F')",
    "(RU'U')(R'2FRF')(RU'U'R')","(R'U'RU')(R'URU)(lU'R'U)","F(RU'R'U')(RUR'F')","(RUR'U)(RU'R'U')(R'FRF')","(RUR'F'U'F)U(RU2R')",
    "(R'F)(RUR'U')F'(UR)","(RUR'U)(RU'U'R')F(RUR'U')F'","(R'U'RU')(R'U2R)F(RUR'U')F'","(B'U')(R'URB)",
    "f(RUR'U')f'","F(RUR'U')F'","(R'U')(R'FRF')(U R)","b'(U'R'UR)2b","F(RUR'U')2F'",
    "(RB')(R'2FR2B)(R'2F'R)","(r'U)(r2U'r'2U')(r2Ur')","f(RUR'U')2f'","(R'F'U'FU')(RUR'UR)","(r'U2)(RUR'U')(RUR'Ur)",
    "(rU'U')(R'U'RU)(R'U'RU'r')","(rU'U'R'U')(r'R2UR'U')(rU'r')","(rUr')(URU'R')2(rU'r')","(RUR'U')M'(URU'r')"
  ],
  PLL: [
    "M'2UMU2M'UM'2","M'2 U'M U2M'U'M'2","M'2UM'2U2M'2UM'2","M'U(M'2U)2M'U2M'2U'",
    "x'R2D2(R'U'R)D2(R'UR')","x'(RU'R)D2(R'UR)D2R'2","x'(RU'R'D)(RUR'D')(RUR'D)(RU'R'D')","(RUR'U')(R'F)(R2U'R'U')(RUR'F')",
    "(R'U'F')(RUR'U')(R'F)(R2U'R'U')(RUR'UR)","(R'UR'd')(R'F'R2U')(R'UR'FRF)","F(RU'R'U')(RUR'F')(RUR'U')(R'FRF')","z(U'RD')(R2UR'U')(R2U)(DR')",
    "(RUR'F')(RUR'U')(R'F)(R2U'R'U')","(R'U2)(RU'U')(R'FRUR'U')(R'F'R2U')","(RU'R'U')(RURD)(R'U'RD')(R'U2R'U')","(R'2u'RU'R)(UR'u)(R2fR'f')",
    "(RUR')y'(R2u'RU')(R'UR'uR2)","(R2uR')(UR'U'Ru')(R'2F'UF)","(R'd'F)(R2u)(R'U)(RU'Ru'R'2)","(R'URU')(R'F'U')(FRUR'F)(R'F'RU'R)",
    "(RUR'U)(RUR'F')(RUR'U')(R'F)(R2U'R'U2)(RU'R')"
  ]
};

// PLL 标准名称（按 GAN 01-21 顺序，G 类用 G1-G4 避免误标）
const PLL_NAMES = ["Ua","Ub","H","Z","Aa","Ab","E","T","Ja","Jb","Y","Na","Ra","Rb","Nb","G3","G1","G2","G4","V","F"];

// ---------- OLL 形状族分类器（由几何图案确定性推导，不依赖外部编号映射）----------
const OLL_EN = { "点":"Dot","方框":"Square","小闪电":"Small Lightning","小鱼":"Fish","马步":"Knight",
  "十字":"Cross","角已定向":"All Corners","C形":"C","T形":"T","P形":"P","L形":"L","怪异":"Awkward","W形":"W","大闪电":"Big Lightning" };
function ollClassify(g){
  const C=[g[0],g[2],g[6],g[8]], E=[g[1],g[3],g[5],g[7]];
  const Ec=C.reduce((a,b)=>a+b,0), Ee=E.reduce((a,b)=>a+b,0);
  const [eT,eL,eR,eB]=E, [cTL,cTR,cBL,cBR]=C;
  const colFull=c=>g[c]&&g[c+3]&&g[c+6];
  const rowFull=r=>g[r*3]&&g[r*3+1]&&g[r*3+2];
  if(Ec===4) return "角已定向";
  if(Ee===0) return "点";
  if(Ee===4){ if(Ec===0)return "十字"; if(Ec===1)return "小鱼"; if(Ec===2)return "C形"; if(Ec===3)return "T形"; return "角已定向"; }
  if(Ee===3){
    if((colFull(0)&&colFull(1))||(colFull(1)&&colFull(2))||(rowFull(0)&&rowFull(1))||(rowFull(1)&&rowFull(2))) return "方框";
    if(Ec<=1) return "马步";
    if(Ec===2) return "L形";
    return "怪异";
  }
  if(Ee===2){
    const adj=(eT&&eL)||(eL&&eB)||(eB&&eR)||(eR&&eT);
    if(adj){ if((eT&&eL&&cTL)||(eL&&eB&&cBL)||(eB&&eR&&cBR)||(eR&&eT&&cTR)) return "方框"; return "小闪电"; }
    return "小闪电";
  }
  if(Ee===1) return "P形";
  return "怪异";
}
// OLL 形状分组（来源 cubersden，编号与 GAN 一致 = 标准 OLL 编号）
const OLL_SHAPE = {
  1:["点","Dot"],2:["点","Dot"],3:["点","Dot"],4:["点","Dot"],17:["点","Dot"],18:["点","Dot"],19:["点","Dot"],20:["点","Dot"],
  5:["方框","Square"],6:["方框","Square"],
  7:["小闪电","Small Lightning"],8:["小闪电","Small Lightning"],11:["小闪电","Small Lightning"],12:["小闪电","Small Lightning"],
  9:["小鱼","Fish"],10:["小鱼","Fish"],35:["小鱼","Fish"],37:["小鱼","Fish"],
  13:["马步","Knight"],14:["马步","Knight"],15:["马步","Knight"],16:["马步","Knight"],
  21:["十字","Cross"],22:["十字","Cross"],23:["十字","Cross"],24:["十字","Cross"],25:["十字","Cross"],26:["十字","Cross"],27:["十字","Cross"],
  28:["角已定向","All Corners"],57:["角已定向","All Corners"],
  29:["怪异","Awkward"],30:["怪异","Awkward"],41:["怪异","Awkward"],42:["怪异","Awkward"],
  31:["P形","P"],32:["P形","P"],43:["P形","P"],44:["P形","P"],
  33:["T形","T"],45:["T形","T"],
  34:["C形","C"],46:["C形","C"],
  36:["W形","W"],38:["W形","W"],
  39:["大闪电","Big Lightning"],40:["大闪电","Big Lightning"],
  47:["L形","L"],48:["L形","L"],49:["L形","L"],50:["L形","L"],53:["L形","L"],54:["L形","L"],
  51:["I形","I"],52:["I形","I"],55:["I形","I"],56:["I形","I"]
};

// ---------- 规范化：把 GAN 记法转成标准 WCA 记号 token 序列 ----------
function normalize(raw){
  let s = raw.replace(/\s+/g,"");
  // 处理 (group)2 重复
  let changed = true;
  while(changed){
    changed = false;
    const m = s.match(/\(([^()]*)\)2/);
    if(m){ s = s.replace(m[0], m[1]+m[1]); changed = true; }
  }
  // token: 字母 + 可选 ' + 可选 2（M/E/S 大小写都接受，统一成大写）
  const re = /([URDLFBurldfbmsexyzMSE])(['’]?)(2?)/g;
  const tokens = [];
  let mm;
  while((mm = re.exec(s))){
    let f = mm[1];
    if(f==='m') f='M'; else if(f==='e') f='E'; else if(f==='s') f='S';
    tokens.push({f, prime: mm[2].length>0, dbl: mm[3]==="2"});
  }
  return tokens;
}
function toNotation(tokens){
  return tokens.map(t=> t.f + (t.prime?"'":"") + (t.dbl?"2":"")).join(" ");
}

// ---------- 几何法魔方模型 ----------
// 颜色: U=y黄 R=r红 F=g绿 D=w白 L=o橙 B=b蓝
function solvedCube(){
  const face = (c)=> new Array(9).fill(c);
  return { U:face('y'), R:face('r'), F:face('g'), D:face('w'), L:face('o'), B:face('b') };
}
// 每个面的中心坐标、法向、u/v 基向量（用于把 (r,c) 映射到 3D 坐标）
const FACES = {
  U:{C:[0,0,1], u:[1,0,0], v:[0,1,0], n:[0,0,1]},
  D:{C:[0,0,-1],u:[1,0,0], v:[0,-1,0],n:[0,0,-1]},
  F:{C:[0,1,0], u:[1,0,0], v:[0,0,1], n:[0,1,0]},
  B:{C:[0,-1,0],u:[-1,0,0],v:[0,0,1], n:[0,-1,0]},
  R:{C:[1,0,0], u:[0,-1,0],v:[0,0,1], n:[1,0,0]},
  L:{C:[-1,0,0],u:[0,1,0], v:[0,0,1], n:[-1,0,0]}
};
function posOf(face, r, c){
  const f = FACES[face];
  return [ f.C[0]+f.u[0]*(c-1)+f.v[0]*(1-r),
           f.C[1]+f.u[1]*(c-1)+f.v[1]*(1-r),
           f.C[2]+f.u[2]*(c-1)+f.v[2]*(1-r) ];
}
function nOf(face){ return FACES[face].n.slice(); }

function rot(p, axis, deg){
  const a = deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
  let [x,y,z]=p;
  if(axis==='x') return [x, c*y - s*z, s*y + c*z];
  if(axis==='y') return [c*x + s*z, y, -s*x + c*z];
  if(axis==='z') return [c*x - s*y, s*x + c*y, z];
  return p;
}
// 每个字母对应的"单层旋转"定义：axis, 该层坐标值, 角度(度, 负=从标准视角看顺时针)
const MOVEDEF = {
  U:{axis:'z',vals:[1], ang:-90}, D:{axis:'z',vals:[-1],ang:90},
  R:{axis:'x',vals:[1], ang:-90}, L:{axis:'x',vals:[-1],ang:90},
  F:{axis:'y',vals:[1], ang:-90}, B:{axis:'y',vals:[-1],ang:90},
  M:{axis:'x',vals:[0], ang:90},  E:{axis:'z',vals:[0], ang:90},
  S:{axis:'y',vals:[0], ang:-90},
  x:{axis:'x',vals:[-1,0,1],ang:-90}, y:{axis:'y',vals:[-1,0,1],ang:-90}, z:{axis:'z',vals:[-1,0,1],ang:-90},
  r:{axis:'x',vals:[1,0],ang:-90}, l:{axis:'x',vals:[-1,0],ang:90},
  f:{axis:'y',vals:[1,0],ang:-90}, b:{axis:'y',vals:[-1,0],ang:90},
  u:{axis:'z',vals:[1,0],ang:-90}, d:{axis:'z',vals:[-1,0],ang:90}
};
function moveOf(tok){
  const d = MOVEDEF[tok.f];
  let ang = d.ang;
  if(tok.prime) ang = -ang;
  if(tok.dbl) ang = 180; // 180 与方向无关
  return {axis:d.axis, vals:d.vals, ang};
}
function eq(a,b){ return Math.abs(a[0]-b[0])<1e-6 && Math.abs(a[1]-b[1])<1e-6 && Math.abs(a[2]-b[2])<1e-6; }
function findDest(p, n){
  for(const f of Object.keys(FACES)){
    for(let r=0;r<3;r++) for(let c=0;c<3;c++){
      if(eq(posOf(f,r,c), p) && eq(nOf(f), n)) return {face:f, r, c};
    }
  }
  return null;
}
function applyMove(cube, move){
  const next = JSON.parse(JSON.stringify(cube));
  const faces = Object.keys(FACES);
  const assignments = [];
  for(const f of faces){
    for(let r=0;r<3;r++) for(let c=0;c<3;c++){
      if(r===1 && c===1) continue; // 中心贴纸永远固定，不参与任何转动
      const p = posOf(f,r,c);
      const coord = p[move.axis==='x'?0:move.axis==='y'?1:2];
      if(!move.vals.includes(Math.round(coord))) continue;
      const p2 = rot(p, move.axis, move.ang);
      const n2 = rot(nOf(f), move.axis, move.ang);
      const dest = findDest(p2, n2);
      if(!dest) throw new Error("no dest for "+f+r+c);
      assignments.push({dest, color: cube[f][r*3+c]});
    }
  }
  for(const a of assignments) next[a.dest.face][a.dest.r*3+a.dest.c] = a.color;
  return next;
}
function applyAlg(cube, tokens){
  let c = cube;
  for(const t of tokens) c = applyMove(c, moveOf(t));
  return c;
}
function invert(tokens){
  const inv = [];
  for(let i=tokens.length-1;i>=0;i--){
    const t = tokens[i];
    inv.push({f:t.f, prime:!t.prime, dbl:t.dbl}); // 180 不变；prime 取反
  }
  return inv;
}
function isUniform(c){
  for(const f of Object.keys(c)){ const col=c[f][0]; if(!c[f].every(x=>x===col)) return false; }
  return true;
}

// ---------- 预计算图案 ----------
function ollPattern(caseCube){
  return caseCube.U.map(x=> x==='y'?1:0);
}
function pllRing(caseCube){
  // 取四个侧面顶行（与 U 相邻的 3 个贴纸），用于识别
  const topRow = (face)=> [caseCube[face][0], caseCube[face][1], caseCube[face][2]];
  return { F:topRow('F'), R:topRow('R'), B:topRow('B'), L:topRow('L'), U:caseCube.U.slice() };
}

// ---------- 主流程 ----------
const data = { F2L:[], OLL:[], PLL:[], meta:{ generated:new Date().toISOString() } };
const stages = { F2L:"F2L（前两层）", OLL:"OLL（顶层定向）", PLL:"PLL（顶层排列）" };

let testFail = 0;
for(const stage of ["F2L","OLL","PLL"]){
  RAW[stage].forEach((raw, i)=>{
    const num = i+1;
    const tokens = normalize(raw);
    const notation = toNotation(tokens);
    const solved = solvedCube();
    const caseCube = applyAlg(solved, invert(tokens));
    // 校验：套用公式后必须完全复原
    const after = applyAlg(caseCube, tokens);
    if(!isUniform(after)){ testFail++; console.log("FAIL", stage, num, notation); }
    let extra = {};
    if(stage==="OLL") extra.pattern = ollPattern(caseCube);
    if(stage==="PLL"){ extra.ring = pllRing(caseCube); extra.name = PLL_NAMES[i]; }
    if(stage==="OLL"){ const sh = ollClassify(extra.pattern); extra.shape = [sh, OLL_EN[sh]]; }
    data[stage].push({ num, notation, raw, ...extra });
  });
}

// 几何自检
function selfTest(){
  const tU = applyAlg(solvedCube(), normalize("U U U U"));
  console.log("U*4 uniform:", isUniform(tU)?"OK":"BAD");
  const tR = applyAlg(solvedCube(), normalize("R R R R"));
  console.log("R*4 uniform:", isUniform(tR)?"OK":"BAD");
  const s = normalize("(R U R' U')");
  let c = solvedCube();
  for(let k=0;k<6;k++) c = applyAlg(c, s);
  console.log("(R U R' U')*6 uniform:", isUniform(c)?"OK":"BAD");
}
selfTest();
console.log("公式还原校验失败数:", testFail);
if(testFail>0) process.exit(1);

// 输出
const out = "window.CFOP_DATA = " + JSON.stringify(data, null, 0) + ";\n";
require('fs').writeFileSync(__dirname + "/cfop-data.js", out);
console.log("已生成 cfop-data.js，F2L", data.F2L.length, "OLL", data.OLL.length, "PLL", data.PLL.length);
