/* diag_run.js — 本地运行诊断自测，产出 diag-report.json（开发者分析用）
   作用：模拟 App 内「运行自检」跑出的报告，开发者（千分尺）据此分析并改善代码。
   用法：node tools/diag_run.js
   它会把 src/10-engine.js + 60-gan.js + 50-battle.js + 70-diag.js 拼成一份脚本，
   在带 DOM 桩的沙箱里跑 runDiagnostics()，输出 tools/diag-report.json。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* 基础 DOM / 浏览器环境桩（仅满足"加载期 + 自测期"不报错，不做真实渲染） */
const fakeEl = new Proxy({}, {
  get(t, k){
    if (k === 'style') return {};
    if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains(){return false;} };
    if (k === 'dataset') return {};
    if (k === 'appendChild' || k === 'removeChild' || k === 'addEventListener' || k === 'removeEventListener' || k === 'scrollIntoView' || k === 'focus' || k === 'setAttribute' || k === 'getAttribute') return () => {};
    if (k === 'querySelector' || k === 'querySelectorAll' || k === 'getElementById') return () => null;
    if (k === 'innerHTML' || k === 'textContent' || k === 'value' || k === 'className') return '';
    return undefined;
  },
  set(){ return true; }
});
const sandbox = {
  console,
  Math, Date, JSON, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN,
  setTimeout: () => 0, clearTimeout: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  performance: { now: () => Date.now() },
  navigator: { userAgent: 'node-diag-runner' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: {
    addEventListener: () => {}, removeEventListener: () => {},
    getElementById: () => fakeEl, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => fakeEl, createElementNS: () => fakeEl,
    body: fakeEl
  },
  window: { addEventListener: () => {}, removeEventListener: () => {} }
};
sandbox.globalThis = sandbox;
sandbox.window.navigator = sandbox.navigator;

const ctx = vm.createContext(sandbox);

/* 拼接顺序尽量贴近真实加载顺序（10 在前，提供几何/解析基础设施） */
const parts = ['src/10-engine.js', 'src/60-gan.js', 'src/50-battle.js', 'src/70-diag.js']
  .map(read).join('\n;\n');

/* 浏览器里 mFollowTokEq / mFollowInv 由 20-ui.js 提供；本地不加载 20-ui，
   这里补一份等价实现（纯函数，与 20-ui 中一致）。 */
const shim = `
function mFollowTokEq(a,b){ return a.f===b.f && !!a.prime===!!b.prime && !!a.dbl===!!b.dbl; }
function mFollowInv(t){ return t.dbl ? {f:t.f,prime:t.prime,dbl:true} : {f:t.f,prime:!t.prime,dbl:false}; }
;globalThis.__report = runDiagnostics();
`;

try {
  vm.runInContext(parts + '\n;\n' + shim, ctx, { filename: 'diag-bundle.js' });
} catch (e) {
  console.error('运行诊断脚本出错：', e && e.stack || e);
  process.exit(1);
}

const report = sandbox.__report;
const outPath = path.join(__dirname, 'diag-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

/* 控制台摘要 */
const line = '--------------------------------------------------';
console.log(line);
console.log('诊断自测报告  ' + report.when);
console.log('通过 ' + report.pass + ' / 共 ' + report.total + (report.fail ? '  ❌ 未通过 ' + report.fail : '  ✅ 全部通过'));
console.log(line);
report.results.forEach(r => {
  const mark = r.pass ? '✅' : (r.severity === 'high' ? '🔴' : r.severity === 'med' ? '🟠' : '🟡');
  console.log(mark + ' ' + r.id + '  ' + r.name);
  console.log('    ' + r.detail);
});
console.log(line);
if (report.problems.length){
  console.log('待改善的问题 (' + report.problems.length + ')：');
  report.problems.forEach(p => {
    console.log('  [' + p.severity + '] ' + p.name + '：' + p.detail);
    if (p.fix) console.log('       建议：' + p.fix);
  });
} else {
  console.log('无未通过项 —— 当前代码在已覆盖的自测上稳定。');
}
console.log('报告已写出：' + outPath);
