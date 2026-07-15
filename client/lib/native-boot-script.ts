/** Inline script — runs before React. Native cold start + keep app off marketing landing. */
export const NATIVE_BOOT_SCRIPT = `(function(){
  try {
    var cap = window.Capacitor;
    var proto = location.protocol || '';
    var host = location.hostname || '';
    var port = location.port || '';
    var bundledNative = proto.indexOf('capacitor') === 0 ||
      ((host === 'localhost' || host === '127.0.0.1') && port !== '3000');
    var native = (cap && cap.isNativePlatform && cap.isNativePlatform()) || bundledNative;
    if (!native) return;

    var SITE = (host === 'gatorvaultinsider.com' || host === 'www.gatorvaultinsider.com')
      ? location.origin
      : bundledNative
        ? location.origin
        : 'https://gatorvaultinsider.com';
    var COLD_KEY = 'gv_native_cold_done';

    function routePath(path) {
      var p = (path || '/').replace(/\\/$/, '') || '/';
      if (p.slice(-11) === '/index.html') p = p.slice(0, -11) || '/';
      return p || '/';
    }

    function staticFilePath(pathname) {
      var p = pathname || '/';
      if (p.charAt(0) !== '/') p = '/' + p;
      var parts = p.split('/').filter(Boolean);
      var last = parts[parts.length - 1] || '';
      if (last && /\\.[a-z0-9]+$/i.test(last)) {
        return p.charAt(p.length - 1) === '/' ? p.replace(/\\/+$/, '') : p;
      }
      if (p === '/') return '/index.html';
      return (p.charAt(p.length - 1) === '/' ? p : p + '/') + 'index.html';
    }

    function abs(path) {
      if (!path) return SITE + (bundledNative ? '/index.html' : '/');
      if (path.indexOf('http') === 0) return path;
      try {
        var u = new URL(path, SITE);
        var filePath = bundledNative ? staticFilePath(u.pathname) : u.pathname;
        return SITE + filePath + u.search + u.hash;
      } catch (e) {
        return SITE + (path.charAt(0) === '/' ? path : '/' + path);
      }
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

    /** Fresh process: sign-in if logged out, vault home if logged in (ignore WKWebView restore). */
    function vaultDest() {
      return sessionOk()
        ? abs('/vault/')
        : abs('/join/?mode=signin&next=/vault/');
    }

    function isMarketingPath(path) {
      var p = routePath(path);
      return p === '/' || p === '/welcome' || p === '/insider';
    }

    function takeColdStart() {
      try {
        if (sessionStorage.getItem(COLD_KEY)) return false;
        sessionStorage.setItem(COLD_KEY, '1');
        return true;
      } catch (e) {
        return false;
      }
    }

    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var raw = a.getAttribute('href');
      if (!raw || raw.charAt(0) === '#' || raw.indexOf('http') === 0 ||
          raw.indexOf('mailto:') === 0 || raw.indexOf('tel:') === 0) return;

      if (bundledNative) {
        e.preventDefault();
        e.stopPropagation();
        try {
          var u = new URL(raw, SITE);
          if (isMarketingPath(u.pathname)) {
            location.href = vaultDest();
            return;
          }
        } catch (err) {}
        location.href = abs(norm(raw));
        return;
      }

      var fixed = norm(raw);
      if (fixed !== raw) {
        e.preventDefault();
        location.href = abs(fixed);
        return;
      }
      try {
        var u2 = new URL(raw, SITE);
        if (isMarketingPath(u2.pathname)) {
          e.preventDefault();
          location.href = vaultDest();
        }
      } catch (err2) {}
    }, true);

    var path = routePath(location.pathname || '/');
    var cold = takeColdStart();
    if (cold || isMarketingPath(path)) {
      var dest = vaultDest();
      if (location.href !== dest) location.replace(dest);
    }
  } catch (e) {}
})();`;
