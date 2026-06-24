/** Inline script — runs before React. Keeps native app off marketing/pricing landing. */
export const NATIVE_BOOT_SCRIPT = `(function(){
  try {
    var cap = window.Capacitor;
    var native = cap && cap.isNativePlatform && cap.isNativePlatform();
    if (!native) return;

    var SITE = 'https://gatorvaultinsider.com';

    function abs(path) {
      if (!path) return SITE + '/';
      if (path.indexOf('http') === 0) return path;
      return SITE + (path.charAt(0) === '/' ? path : '/' + path);
    }

    function norm(href) {
      if (!href || href.charAt(0) === '#' || href.indexOf('http') === 0) return href;
      try {
        var u = new URL(href, SITE);
        var p = u.pathname || '/';
        var last = p.split('/').filter(Boolean).pop() || '';
        if (last.indexOf('.') === -1 && p.charAt(p.length - 1) !== '/') p += '/';
        return p + u.search + u.hash;
      } catch (e) { return href; }
    }

    function sessionOk() {
      try {
        var raw = localStorage.getItem('gv_session');
        if (!raw) return false;
        var s = JSON.parse(raw);
        return !!(s && s.email && s.token);
      } catch (e) { return false; }
    }

    function vaultDest() {
      return sessionOk()
        ? abs('/vault/')
        : abs('/join/?mode=signin&next=/vault/');
    }

    function isMarketingPath(path) {
      var p = (path || '/').replace(/\\/$/, '') || '/';
      return p === '/' || p === '/welcome' || p === '/insider';
    }

    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var raw = a.getAttribute('href');
      if (!raw) return;
      var fixed = norm(raw);
      if (fixed !== raw) {
        e.preventDefault();
        location.href = abs(fixed);
        return;
      }
      try {
        var u = new URL(raw, SITE);
        var p = u.pathname.replace(/\\/$/, '') || '/';
        if (isMarketingPath(p)) {
          e.preventDefault();
          location.href = vaultDest();
        }
      } catch (err) {}
    }, true);

    var path = (location.pathname || '/').replace(/\\/$/, '') || '/';
    if (isMarketingPath(path)) {
      var dest = vaultDest();
      if (location.href !== dest) location.replace(dest);
    }
  } catch (e) {}
})();`;