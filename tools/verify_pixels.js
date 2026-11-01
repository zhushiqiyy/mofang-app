/* 像素级取证：解码 Edge 截图的 PNG，统计玩伴区域的
   - 着色像素占比（确认角色真的画出来了，不是空白）
   - 颜色多样性（确认是有层次的造型，不是纯色块）
   - 轮廓宽度分布（确认有纵深，不是一条线）
   不依赖任何第三方图像库，纯 zlib 解 PNG。 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

/* ---- 最小 PNG 解码器（RGBA8） ---- */
function decodePNG(buf) {
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.toString('ascii', off, off + 4); off += 4;
    const data = buf.slice(off, off + len); off += len + 4;
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
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

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    args: ['--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const results = [];
  for (const id of ['classic', 'ange', 'lixing', 'tiga', 'conan', 'pika']) {
    await page.evaluate((cid) => {
      equipSkin('comp', cid);
      go('practice');
    }, id);
    await page.waitForTimeout(500);

    const el = await page.$('#practice-companion .stage3d');
    const shot = await el.screenshot({ type: 'png' });
    const img = decodePNG(shot);

    /* 统计（跳过透明像素） */
    let painted = 0, total = 0;
    const colors = new Set();
    const rowInk = [];
    for (let y = 0; y < img.h; y++) {
      let rw = 0;
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * img.ch;
        const a = img.ch === 4 ? img.data[i + 3] : 255;
        if (a < 24) continue;
        total++;
        const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
        /* 与页面背景（近白）差异明显才算"画上去的" */
        if (Math.abs(r - 245) + Math.abs(g - 246) + Math.abs(b - 250) > 40) {
          painted++; rw++;
          colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
        }
      }
      rowInk.push(rw);
    }
    /* 轮廓：有着色的行数占比 + 最大行宽 */
    const inkedRows = rowInk.filter(v => v > 0).length;
    const maxRow = Math.max(...rowInk);
    const avgRow = inkedRows ? rowInk.reduce((a, b) => a + b, 0) / inkedRows : 0;
    results.push({
      id, painted, coverage: (painted / Math.max(total, 1) * 100).toFixed(1) + '%',
      colors: colors.size, inkedRows, maxRow, avgRow: avgRow.toFixed(0),
      pass: painted > 800 && colors.size >= 12 && inkedRows >= 30
    });
    console.log((results[results.length - 1].pass ? 'PASS' : 'FAIL') +
      ' :: ' + id.padEnd(8) +
      ' 着色像素=' + String(painted).padStart(6) +
      ' 覆盖率=' + results[results.length - 1].coverage.padStart(6) +
      ' 颜色数=' + String(colors.size).padStart(4) +
      ' 着色行=' + String(inkedRows).padStart(3) + '/' + img.h +
      ' 最宽行=' + String(maxRow).padStart(4) + 'px');
  }

  console.log('\nJS errors: ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ' + e));
  const fails = results.filter(r => !r.pass).length;
  console.log('\nRESULT: ' + (results.length - fails) + ' passed, ' + fails + ' failed');
  await browser.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
