/* 运行时核验：真 3D 玩伴在浏览器 WebGL 中能否加载并渲染
 * 用法: node tools/verify_mascot3d.js
 * 依赖 playwright-core + 本机 Edge；本地服务需已在 8099 端口运行
 */
const { chromium } = require('playwright-core');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8099/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // 等 3D 引擎就绪
  await page.waitForFunction(() => !!(window.Mascot3D && window.Mascot3D.has3D), { timeout: 15000 });
  const engine = await page.evaluate(() => ({
    hasEngine: !!window.Mascot3D,
    roles: Object.keys(window.Mascot3D.MODEL || {}),
    hasConan: window.Mascot3D.has3D('conan'),
    hasAngemon: window.Mascot3D.has3D('ange'),
    hasPika: window.Mascot3D.has3D('pika'),
    hasNailong: window.Mascot3D.has3D('nailong'),
    noClassic: !window.Mascot3D.has3D('classic')
  }));
  console.log('ENGINE', JSON.stringify(engine));

  // 切到皮肤小屋（4 个 3D 卡片 + 其余 SVG）
  await page.evaluate(() => go('skin'));
  await page.waitForTimeout(500);
  const skin = await page.evaluate(() => ({
    cards: document.querySelectorAll('.skin-card').length,
    m3dHosts: document.querySelectorAll('.m3d-host').length,
    canvases: document.querySelectorAll('.m3d-host canvas').length,
    badges: Array.from(document.querySelectorAll('.m3d-badge')).map(b => b.textContent)
  }));
  console.log('SKIN', JSON.stringify(skin));

  // 等柯南模型加载（42MB，给足时间）
  await page.waitForFunction(() => {
    const h = document.querySelector('.m3d-host[data-role="conan"]');
    if (!h) return false;
    const b = h.querySelector('.m3d-badge');
    return !b || b.style.display === 'none' || /失败|不支持/.test(b.textContent);
  }, { timeout: 90000 }).catch(() => {});

  const conan = await page.evaluate(() => {
    const h = document.querySelector('.m3d-host[data-role="conan"]');
    if (!h) return { found: false };
    const cv = h.querySelector('canvas');
    const badge = h.querySelector('.m3d-badge');
    let pixels = null;
    if (cv) {
      try {
        const g = cv.getContext('webgl2') || cv.getContext('webgl');
        pixels = { w: cv.width, h: cv.height, ctx: !!g };
      } catch (e) { pixels = { err: String(e) }; }
    }
    return {
      found: true,
      canvas: !!cv,
      badgeText: badge ? badge.textContent : null,
      badgeHidden: badge ? (badge.style.display === 'none') : null,
      pixels
    };
  });
  console.log('CONAN', JSON.stringify(conan));

  await page.screenshot({ path: path.join(__dirname, 'mascot3d-skin.png'), fullPage: true });

  // 回首页看大玩伴
  await page.evaluate(() => go('home'));
  await page.waitForTimeout(1200);
  const home = await page.evaluate(() => {
    const h = document.querySelector('#home-companion .m3d-host');
    return {
      m3dHost: !!h,
      canvas: !!(h && h.querySelector('canvas')),
      badge: h && h.querySelector('.m3d-badge') ? h.querySelector('.m3d-badge').textContent : null,
      name: document.querySelector('#home-companion .companion-name') ? document.querySelector('#home-companion .companion-name').textContent.trim() : null
    };
  });
  console.log('HOME', JSON.stringify(home));
  await page.screenshot({ path: path.join(__dirname, 'mascot3d-home.png'), fullPage: true });

  console.log('ERRORS', errs.length, errs.slice(0, 8).join(' | '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.stack || e); process.exit(1); });
