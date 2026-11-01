/* 构建脚本：把 src/ 模块拼接为自包含单文件 index.html */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const HTML_PARTS = ['src/01-head.html', 'src/02-body.html'];
const JS_PARTS = [
  'src/10-engine.js',   // 魔方几何 + 轴测/平面渲染
  'src/15-content.js',  // 形象化讲解文案
  'src/20-ui.js',       // 路由 / 首页 / 地图 / 记号营 / 公式库 / 弹窗 / 关联 / 成就
  'src/30-sense.js',    // 色块位置感知训练
  'src/40-quest.js',    // 森林·山顶·城堡 闯关
  'src/50-battle.js',   // 实战 + 人机对战
  'src/60-gan.js',      // GAN356i 蓝牙（含校准 / 归零）
  'src/65-skins.js',    // 玩伴 + 皮肤小屋（免费换装）
  'src/66-roadmap.js',  // 从零到完全掌握的进阶学习路线
  'src/90-boot.js'      // 启动
];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

let html = '';
for (const p of HTML_PARTS) html += read(p);

/* 语法预检每一个 JS 模块 */
let js = '';
for (const p of JS_PARTS) {
  const src = read(p);
  try { new Function(src); }
  catch (e) { console.error('[语法错误] ' + p + ' -> ' + e.message); process.exit(1); }
  js += '\n/* ==== ' + p + ' ==== */\n' + src;
}

/* 内联公式数据 */
let data = read('cfop-data.js').trim();
if (data.indexOf('</scr' + 'ipt>') >= 0) { console.error('数据中含 </script>'); process.exit(1); }

html += '<script>\n' + data + '\n</scr' + 'ipt>\n';
html += '<script>\n' + js + '\n</scr' + 'ipt>\n';
html += '</body>\n</html>\n';

fs.writeFileSync(path.join(ROOT, 'index.html'), html);

/* 复制 PWA 资源（manifest / service worker / 图标）到根目录，随站点一起发布 */
const BUILD_ID = Date.now().toString(36);
const PWA = path.join(ROOT, 'pwa');
if (fs.existsSync(PWA)) {
  let n = 0;
  for (const f of fs.readdirSync(PWA)) {
    if (f.endsWith('.py')) continue; // 不发布生成脚本
    let buf = fs.readFileSync(path.join(PWA, f));
    if (f.endsWith('.js') || f.endsWith('.webmanifest')){
      /* 注入构建号：sw 缓存名每次构建都不同，旧缓存自动清掉 */
      buf = Buffer.from(buf.toString('utf8').replace(/__BUILD__/g, BUILD_ID), 'utf8');
    }
    fs.writeFileSync(path.join(ROOT, f), buf);
    n++;
  }
  console.log('   复制 PWA 资源 ' + n + ' 个，构建号 ' + BUILD_ID);
}

const kb = (fs.statSync(path.join(ROOT, 'index.html')).size / 1024).toFixed(1);
console.log('✅ 构建完成 index.html (' + kb + ' KB)');
console.log('   模块: ' + JS_PARTS.length + ' 个 JS + ' + HTML_PARTS.length + ' 个 HTML');
