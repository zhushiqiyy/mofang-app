/* 魔方小将 Service Worker
 * 策略：页面（导航/index.html）走「网络优先」，保证每次打开都是最新版本；
 *       图片/图标走「缓存优先」；断网时自动回退到缓存，仍可离线使用。
 * 版本号由 build.js 在构建时替换，每次构建都会换新缓存并清掉旧的。
 */
const CACHE = 'mofang-mwgn22qi';
const PRECACHE = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isDoc(req, url){
  return req.mode === 'navigate' || url.pathname === '/' || /index\.html$/.test(url.pathname);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isDoc(req, url)) {
    /* 网络优先：有新版本立刻用新的；没网就用缓存 */
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('index.html', copy));
        return res;
      }).catch(() =>
        caches.match('index.html').then((c) => c || caches.match('.'))
      )
    );
    return;
  }

  /* 静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
