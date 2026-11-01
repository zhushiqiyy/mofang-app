/* tools/shotel.js — 元素级高清截图
   用法: node tools/shotel.js <url> <w> <h> <selector> <out.png> [js] [scale]
*/
const fs = require('fs');
const http = require('http');

function getJSON(url){
  return new Promise((res, rej) => {
    http.get(url, r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ try{res(JSON.parse(d));}catch(e){rej(e);} }); }).on('error', rej);
  });
}

async function main(){
  const [url, w, h, selector, out, js, scaleArg] = process.argv.slice(2);
  const scale = parseFloat(scaleArg || '3');
  const list = await getJSON('http://127.0.0.1:9222/json');
  const target = list.find(t => t.type === 'page');
  if (!target) throw new Error('no page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const exceptions = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown'){
      exceptions.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
    }
  };
  await new Promise(r => { ws.onopen = r; });
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, m => m.error ? rej(new Error(method+': '+JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  try { await send('Network.setBypassServiceWorker', { bypass: true }); } catch(e){ console.error('(SW bypass 不可用)'); }
  await send('Emulation.setDeviceMetricsOverride', {
    width: +w, height: +h, deviceScaleFactor: scale, mobile: true, screenWidth: +w, screenHeight: +h
  });
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 1500));

  if (js){
    const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) console.error('JS ERROR:', JSON.stringify(r.exceptionDetails.exception));
    else if (r.result && r.result.value !== undefined) console.log('JS:', JSON.stringify(r.result.value));
    await new Promise(r => setTimeout(r, 700));
  }

  const rect = await send('Runtime.evaluate', {
    expression: `(function(){ var e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null; var r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`,
    returnByValue: true
  });
  const b = rect.result.value;
  if (!b) throw new Error('selector not found: ' + selector);
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 }
  });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out, 'rect', JSON.stringify(b));
  if (exceptions.length) console.error('EXCEPTIONS:', exceptions.slice(0,3));
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
