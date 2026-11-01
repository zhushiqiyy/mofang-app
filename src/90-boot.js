/* =========================================================================
   90-boot.js — 启动
   ========================================================================= */
(function boot(){
  updateStreak();
  if (typeof initSkins === 'function') initSkins();   /* 套上已保存的魔方/玩伴皮肤 */
  refreshTopStars();
  go('home');

  /* 注册 Service Worker（仅 http/https 有效；file:// 下静默失败） */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* 防止双击缩放（iPad 上容易误触） */
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  /* 首次访问引导 */
  if (!localStorage.getItem('cfop_boot_tip')){
    localStorage.setItem('cfop_boot_tip', '1');
    setTimeout(() => {
      toast('👇 先看「地图」，从第一阶段开始');
    }, 1200);
  }

  /* 诊断模式：?diag=1 时把布局宽度写进标题，便于自动化校验 */
  if (location.search.indexOf('diag') >= 0){
    setTimeout(() => {
      const all = document.querySelectorAll('*');
      const W = document.documentElement.clientWidth;
      let bad = [];
      for (const el of all){
        const r = el.getBoundingClientRect();
        if (r.width > W + 1) bad.push(el.tagName + '.' + (el.className || ''));
      }
      document.title = 'VIEW=' + W + ' BODY=' + document.body.scrollWidth +
        ' DOC=' + document.documentElement.scrollWidth + ' BAD=' + bad.slice(0,6).join('|');
    }, 600);
  }
})();
