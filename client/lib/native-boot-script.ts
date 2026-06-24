/** Inline script for root layout — runs before React, fixes Capacitor routing. */
export const NATIVE_BOOT_SCRIPT = `(function(){
  try {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

    function norm(href) {
      if (!href || href.charAt(0) === '#' || href.indexOf('http') === 0) return href;
      try {
        var u = new URL(href, location.origin);
        var p = u.pathname || '/';
        var last = p.split('/').filter(Boolean).pop() || '';
        if (last.indexOf('.') === -1 && p.charAt(p.length - 1) !== '/') p += '/';
        return p + u.search + u.hash;
      } catch (e) { return href; }
    }

    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var raw = a.getAttribute('href');
      if (!raw) return;
      var fixed = norm(raw);
      if (fixed !== raw) { e.preventDefault(); location.href = fixed; }
    }, true);

    var path = (location.pathname || '/').replace(/\\/$/, '') || '/';
    if (path !== '/' && path !== '/welcome') return;

    var dest = '/join/?mode=signin&next=/vault/';
    try {
      var raw = localStorage.getItem('gv_session');
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.email && s.token) dest = '/vault/';
      }
    } catch (e) {}
    var here = location.pathname + location.search;
    if (here !== dest) location.replace(dest);
  } catch (e) {}
})();`;
