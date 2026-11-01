/* 纯色渲染取证：确认轴侧图（3D 魔方）贴纸是"纯色平坦块"，不是渐变。
   方法：Edge 截图 #prac-3d → 解码 PNG → 统计
   - 每个经典色的"精确像素"（纯色填充应是大块平坦区域）
   - 每个经典色的"近似色带像素"（±18 容差但非精确，渐变会占大面积）
   判定：可见面的精确像素数应远大于近似色带像素数。 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

function decodePNG(buf) {
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.toString('ascii', off, off + 4); off += 4;
    const data = buf.slice(off, off + len); off += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

const PAL = {
  y: [0xFF, 0xD5, 0x00], r: [0xE8, 0x12, 0x1D], g: [0x00, 0x9E, 0x54],
  w: [0xFF, 0xFF, 0xFF], o: [0xFF, 0x6A, 0x00], b: [0x00, 0x51, 0xBA]
};

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

  /* 默认经典皮肤（无特效、无扫光），打乱一下让多个面都有不同色 */
  await page.evaluate(() => { go('practice'); });
  await page.waitForTimeout(500);
  const shot = await page.locator('#prac-3d').screenshot();
  fs.writeFileSync(path.join(__dirname, 'flat-cube.png'), shot);

  const img = decodePNG(shot);
  const exact = { y:0, r:0, g:0, w:0, o:0, b:0 };
  const near  = { y:0, r:0, g:0, w:0, o:0, b:0 };
  for (let i = 0; i < img.w * img.h; i++) {
    const R = img.data[i*img.ch], G = img.data[i*img.ch+1], B = img.data[i*img.ch+2];
    for (const k in PAL) {
      const [pr, pg, pb] = PAL[k];
      if (R === pr && G === pg && B === pb) { exact[k]++; continue; }
      if (Math.abs(R-pr) <= 18 && Math.abs(G-pg) <= 18 && Math.abs(B-pb) <= 18) near[k]++;
    }
  }

  const out = [];
  let ok = true;
  const visible = Object.keys(exact).filter(k => exact[k] > 200);
  out.push('截图尺寸: ' + img.w + 'x' + img.h + '  可见面色数: ' + visible.length);
  for (const k of ['y','r','g','w','o','b']) {
    const ratio = exact[k] > 0 ? (near[k] / exact[k]) : -1;
    const line = '  ' + k + '  精确像素=' + String(exact[k]).padStart(6) +
                 '  近似色带=' + String(near[k]).padStart(6) +
                 '  色带/精确=' + (ratio < 0 ? '  （该面不可见）' : ratio.toFixed(3));
    out.push(line);
  }
  /* 判定：可见面的精确像素必须远多于近似色带（纯色=平坦大块；渐变=色带占大面积） */
  for (const k of visible) {
    if (near[k] > exact[k] * 0.6) { ok = false; out.push('FAIL ' + k + ' 面色带过多，疑似仍有渐变'); }
  }
  if (visible.length < 3) { ok = false; out.push('FAIL 可见面少于 3 个'); }
  out.push(ok ? 'PASS 轴侧图贴纸为纯色平坦渲染（与分解图同色系）' : 'FAIL 检测到渐变渲染');
  console.log(out.join('\n'));
  console.log('JS errors: ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log(e));
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
