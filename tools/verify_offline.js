/* 离线能力实测：Edge 加载页面 → 等 SW 注册激活 → 断网 → 刷新 → 页面仍可用 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:8080';

function probe() {
  return new Promise(res => {
    const req = http.get(BASE + '/', r => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.setTimeout(1000, () => { req.destroy(); res(false); });
  });
}

(async () => {
  /* 若端口已有服务则复用，否则启动并轮询就绪 */
  let srv = null;
  if (!(await probe())) {
    srv = spawn(process.execPath, ['serve.js'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
    for (let i = 0; i < 20 && !(await probe()); i++) await new Promise(r => setTimeout(r, 500));
    if (!(await probe())) { console.log('ERROR: server failed to start'); if (srv) srv.kill(); process.exit(1); }
  }
  console.log('server ready');
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EDGE, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2500);   /* 等 SW install + activate */

    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg && reg.active ? reg.active.state : 'none';
    });
    console.log('SW 状态: ' + swState);

    /* 断网 */
    await page.context().setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });

    const title = await page.title();
    const hasApp = await page.evaluate(() => !!document.querySelector('#app, .app, body'));
    const bodyLen = await page.evaluate(() => document.body.innerHTML.length);
    console.log('断网刷新后 标题: ' + title);
    console.log('断网刷新后 内容长度: ' + bodyLen);
    console.log('JS 错误: ' + errors.length);
    if (errors.length) console.log(errors.join('\n'));

    if (swState === 'activated' && bodyLen > 5000 && errors.length === 0) {
      console.log('PASS 断网可完整打开 App（与电脑无关）');
    } else {
      console.log('FAIL 离线打开异常');
      process.exitCode = 1;
    }
  } catch (e) {
    console.log('ERROR: ' + e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
})();
