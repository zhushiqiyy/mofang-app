/* 用真实浏览器（playwright-core + Edge）做 3D 分层取证：
   把玩伴舞台旋转到 0° / ±35° / 75°，测量每个 .char-layer 的中心位移与受光。
   - 真 3D 分层：不同 translateZ 的层位移量不同（视差），且近层位移大
   - 纸片人：所有层位移完全一致
   - 动态受光：转过去的面 brightness 递减，背板相反
   做法：把舞台移出自动摆动的 rAF 循环，手动调用产品里的 applyShade()，
   保证测的就是线上代码的真实行为。 */
const path = require('path');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  /* 装备天女兽，以便测量重点角色 */
  await page.evaluate(() => {
    equipSkin('comp', 'ange');
    go('practice');
  });
  await page.waitForTimeout(700);

  /* 取出练习页舞台，移出 rAF 自动摆动，之后手动驱动 */
  await page.evaluate(() => {
    const st = document.querySelector('#practice-companion .stage3d');
    window.__st = st;
    window.__s = null;
    for (let i = _stages.length - 1; i >= 0; i--) {
      if (_stages[i].inner === st.querySelector('.stage3d-inner')) { window.__s = _stages[i]; _stages.splice(i, 1); }
    }
  });

  const setAngle = (deg) => page.evaluate((d) => {
    window.__s.inner.style.transform = 'rotateY(' + d + 'deg)';
    applyShade(window.__s, d);           /* 调用产品里的真实受光函数 */
  }, deg);

  const readLayers = () => page.evaluate(() => {
    const st = window.__st;
    const cont = st.getBoundingClientRect();
    const out = [];
    st.querySelectorAll('.char-layer').forEach(el => {
      const r = el.getBoundingClientRect();
      const m = (el.getAttribute('style') || '').match(/translateZ\((-?[\d.]+)px\)/);
      out.push({ z: m ? parseFloat(m[1]) : 0, cx: r.left + r.width / 2 - (cont.left + cont.width / 2), w: r.width, back: /char-back/.test(el.className), filter: el.style.filter || '' });
    });
    return out;
  });

  await setAngle(0);   const r0  = await readLayers();
  await setAngle(35);  const r35 = await readLayers();
  await setAngle(-35); const rm35 = await readLayers();
  await setAngle(75);  const r75 = await readLayers();

  const f0  = r0.filter(r => !r.back);
  const f35 = r35.filter(r => !r.back);
  const fm  = rm35.filter(r => !r.back);
  console.log('=== 天女兽各层中心位移（相对舞台中心）===');
  f0.forEach((r, i) => console.log('  z=' + String(r.z).padStart(6) +
    '  0°:' + String(f0[i].cx.toFixed(1)).padStart(7) +
    '  +35°:' + String(f35[i].cx.toFixed(1)).padStart(7) +
    '  -35°:' + String(fm[i].cx.toFixed(1)).padStart(7) +
    '  宽35°:' + f35[i].w.toFixed(1)));

  const maxFront = Math.max(...f35.filter(r => r.z >= 0).map(r => Math.abs(r.cx)));
  const maxBack = Math.max(...f35.filter(r => r.z < 0).map(r => Math.abs(r.cx)));
  const parallax = Math.abs(maxFront - maxBack);
  console.log('\n近层最大位移=' + maxFront.toFixed(1) + 'px  远层最大位移=' + maxBack.toFixed(1) + 'px  视差差=' + parallax.toFixed(1) + 'px');
  const pParallax = parallax >= 6;
  console.log(pParallax ? 'PASS 视差明显：真 3D 分层，不是纸片人' : 'FAIL 视差不足：仍像同一平面');

  /* 动态受光：前层 0° 最亮，35° 变暗，75° 更暗 */
  const num = s => { const m = (s || '').match(/brightness\(([\d.]+)\)/); return m ? parseFloat(m[1]) : null; };
  const b0 = num((r0.find(r => !r.back && r.z > 40) || {}).filter);
  const b35 = num((r35.find(r => !r.back && r.z > 40) || {}).filter);
  const b75 = num((r75.find(r => !r.back && r.z > 40) || {}).filter);
  console.log('\n前层(头)受光：0°=' + b0 + '  35°=' + b35 + '  75°=' + b75);
  const pLit = b0 !== null && b35 !== null && b75 !== null && b0 >= b35 && b35 >= b75 && b0 > b75;
  console.log(pLit ? 'PASS 动态受光生效：转过去的面逐渐变暗' : 'FAIL 受光未生效');

  /* 背板：±90° 内应保持稳定的"暗边"（厚度感），亮度明显低于前层 */
  const k0 = num((r0.find(r => r.back) || {}).filter), k75 = num((r75.find(r => r.back) || {}).filter);
  console.log('背板暗边：0°=' + k0 + '  75°=' + k75);
  const pBack = k0 !== null && k75 !== null && k0 < b0 * 0.6;
  console.log(pBack ? 'PASS 背板为稳定暗边（提供厚度感）' : 'WARN 背板亮度异常');

  /* 截图存档 */
  await setAngle(0);  await page.screenshot({ path: path.join(__dirname, 'layer-0deg.png') });
  await setAngle(35); await page.screenshot({ path: path.join(__dirname, 'layer-35deg.png') });

  console.log('\nJS errors: ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));

  await browser.close();
  process.exit(pParallax && pLit && !errs.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
