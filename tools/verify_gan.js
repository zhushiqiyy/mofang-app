/* GAN 蓝牙功能在 iPad 环境下的行为验证：
   1. 模拟 iPad（删除 navigator.bluetooth）→ 点「连接魔方」→ 应出现准确的平台指引，无 JS 错误
   2. 点「模拟一步」→ 验证动作管线真的执行（魔方状态变化）
   3. 探测真实 Edge 是否有 navigator.bluetooth（确认功能目标平台）
   4. GAN 页面三张说明卡渲染完整 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:8080';
let pass = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fails.push(name); console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async () => {
  const srv = spawn(process.execPath, ['serve.js'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EDGE, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    /* 3. 真实 Edge 的蓝牙能力（桌面平台 = 功能目标平台） */
    const hasBT = await page.evaluate(() => !!(navigator.bluetooth && navigator.bluetooth.requestDevice));
    console.log('== 平台能力 ==');
    ok('桌面 Edge 具备网页蓝牙能力（功能目标平台可用）', hasBT === true, 'navigator.bluetooth=' + hasBT);

    /* 1. 模拟 iPad：iPadOS UserAgent（Safari 伪装 Macintosh）+ 无 navigator.bluetooth */
    const ipad = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    });
    const ierrors = [];
    ipad.on('pageerror', e => ierrors.push(String(e)));
    await ipad.goto(BASE + '/', { waitUntil: 'load' });
    await ipad.waitForTimeout(1200);
    await ipad.evaluate(() => {
      /* 完整模拟真实 iPad：iPadOS Safari 伪装 Macintosh + 多点触控 */
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
      Object.defineProperty(navigator, 'bluetooth', { value: undefined, configurable: true });
    });
    await ipad.evaluate(() => go('gan'));
    await ipad.waitForTimeout(400);

    const pageVisible = await ipad.evaluate(() => {
      const el = document.querySelector('#page-gan');
      return el && getComputedStyle(el).display !== 'none';
    });
    ok('GAN 页面可正常打开', pageVisible === true);

    /* 四张说明卡 */
    const cards = await ipad.evaluate(() => document.querySelectorAll('#page-gan .card').length);
    ok('GAN 页四张说明卡齐全', cards === 4, cards + ' cards');

    await ipad.evaluate(() => pracConnectGAN());
    await ipad.waitForTimeout(300);
    const status = await ipad.evaluate(() => document.querySelector('#gan-status').textContent);
    console.log('== 模拟 iPad 点「连接魔方」==');
    ok('提示包含「原生 App」解决方案', status.includes('原生 App'));
    ok('不再误导用户装 Chrome/Edge', !/请用.*Chrome/.test(status));
    ok('无 JS 错误', ierrors.length === 0, ierrors.length ? ierrors[0] : '');

    /* 2. 模拟一步：验证动作管线（不需要真魔方） */
    await page.evaluate(() => go('practice'));
    await page.waitForTimeout(300);
    const cubeBefore = await page.evaluate(() => JSON.stringify(pracCube));
    await page.evaluate(() => ganSimMove());
    await page.waitForTimeout(500);
    const cubeAfter = await page.evaluate(() => JSON.stringify(pracCube));
    const onPractice = await page.evaluate(() => currentPage === 'practice');
    const toastTxt = await page.evaluate(() => {
      const t = document.querySelector('.toast, #toast, [class*=toast]');
      return t ? t.textContent : '';
    });
    console.log('== 模拟一步（动作管线）==');
    ok('模拟一步后跳转/停留在练习页', onPractice === true);
    ok('魔方状态真的被改变（管线通）', cubeBefore !== cubeAfter);
    ok('模拟一步给出 toast 反馈', toastTxt.includes('模拟一步'), toastTxt.slice(0, 30));
    ok('模拟一步未引发 JS 错误', errors.length === 0, errors.length ? errors[0] : '');

    console.log('');
    console.log('结果: ' + pass + ' 通过, ' + fails.length + ' 失败');
    if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exitCode = 1; }
    else console.log('✅ GAN 蓝牙功能验证全部通过');
  } catch (e) {
    console.log('ERROR: ' + e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
})();
