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
    var SPA_KEY = 'gv_native_spa_path';

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

    /** Fresh process: Create account on first install; Sign in if we remember an email. */
    function vaultDest() {
      if (sessionOk()) return abs('/vault/');
      var remembered = false;
      try {
        remembered = !!(localStorage.getItem('gv_last_email') || '').trim();
      } catch (e) {}
      return abs(remembered
        ? '/join/?mode=signin&next=/vault/'
        : '/join/?mode=signup&next=/vault/');
    }

    /** iOS may wipe localStorage; Preferences (UserDefaults) survives — restore before join bounce. */
    function restoreSessionFromPreferences(done) {
      try {
        var plugins = cap && cap.Plugins;
        var Prefs = plugins && plugins.Preferences;
        if (!Prefs || typeof Prefs.get !== 'function') {
          done();
          return;
        }
        var settled = false;
        var finish = function() {
          if (settled) return;
          settled = true;
          done();
        };
        setTimeout(finish, 1200);
        Prefs.get({ key: 'gv_session' }).then(function(res) {
          try {
            if (res && res.value) {
              var s = JSON.parse(res.value);
              if (s && s.email && s.token) {
                localStorage.setItem('gv_session', res.value);
              }
            }
          } catch (e1) {}
          finish();
        }).catch(function() { finish(); });
      } catch (e2) {
        done();
      }
    }

    function isMarketingPath(path) {
      var p = routePath(path);
      return p === '/' || p === '/welcome' || p === '/insider';
    }

    function isVaultClientNav(href) {
      try {
        var p = new URL(href, SITE).pathname.replace(/\\/$/, '') || '/';
        return p === '/vault' || p.indexOf('/vault/') === 0;
      } catch (e) {
        return false;
      }
    }

    /** Catch-all shells — only one index.html exists; deep slugs must not hard-nav to missing files. */
    function catchAllShell(pathname) {
      var p = routePath(pathname);
      var art = p.match(/^\\/articles\\/([^/]+)$/);
      if (art && art[1] && art[1] !== 'detail') return '/vault/articles/';
      var rules = [
        [/^\\/vault\\/recruiting\\/player(?:\\/[^/]+)?$/, '/vault/recruiting/player/'],
        [/^\\/vault\\/futurecast\\/player(?:\\/[^/]+)?$/, '/vault/futurecast/player/'],
        [/^\\/vault\\/portal\\/player(?:\\/[^/]+)?$/, '/vault/portal/player/'],
        [/^\\/vault\\/players(?:\\/[^/]+)?$/, '/vault/players/'],
        [/^\\/vault\\/articles(?:\\/[^/]+)?$/, '/vault/articles/'],
        [/^\\/vault\\/community\\/thread(?:\\/[^/]+)?$/, '/vault/community/thread/'],
        [/^\\/community\\/thread(?:\\/[^/]+)?$/, '/community/thread/'],
        [/^\\/player(?:\\/[^/]+)?$/, '/player/'],
        [/^\\/recruiting\\/player(?:\\/[^/]+)?$/, '/recruiting/player/'],
        [/^\\/futurecast\\/player(?:\\/[^/]+)?$/, '/futurecast/player/'],
        [/^\\/team\\/player(?:\\/[^/]+)?$/, '/team/player/']
      ];
      for (var i = 0; i < rules.length; i++) {
        if (rules[i][0].test(p)) return rules[i][1];
      }
      return null;
    }

    function resolveSpaHref(href) {
      try {
        var u = new URL(href, SITE);
        var p = routePath(u.pathname);
        var art = p.match(/^\\/articles\\/([^/]+)$/);
        if (art && art[1] && art[1] !== 'detail') {
          return '/vault/articles/' + encodeURIComponent(art[1]) + '/' + u.search + u.hash;
        }
        return norm(href);
      } catch (e) {
        return href;
      }
    }

    function isCatchAllDynamic(pathname) {
      var shell = catchAllShell(pathname);
      if (!shell) return false;
      return routePath(pathname) !== routePath(shell);
    }

    function navigateCatchAll(href) {
      var target = resolveSpaHref(href);
      var shell = catchAllShell(target);
      if (!shell) {
        location.href = abs(target);
        return;
      }
      var curShell = catchAllShell(location.pathname);
      if (curShell && routePath(curShell) === routePath(shell)) {
        history.pushState(null, '', target);
        try { window.dispatchEvent(new Event('vault:navigation')); } catch (e1) {}
        return;
      }
      try { sessionStorage.setItem(SPA_KEY, target); } catch (e2) {}
      location.href = abs(shell);
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

    function consumeSpaPending() {
      try {
        var pending = sessionStorage.getItem(SPA_KEY);
        if (!pending) return;
        sessionStorage.removeItem(SPA_KEY);
        var pendingShell = catchAllShell(pending);
        var curShell = catchAllShell(location.pathname);
        if (pendingShell && curShell && routePath(pendingShell) === routePath(curShell)) {
          history.replaceState(null, '', pending);
        } else if (pendingShell) {
          sessionStorage.setItem(SPA_KEY, pending);
          location.replace(abs(pendingShell));
        }
      } catch (e) {}
    }

    function toAppRelative(href) {
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return href;
      if (href.indexOf('http') !== 0) return href;
      try {
        var au = new URL(href);
        var siteHost = '';
        try { siteHost = new URL(SITE).hostname; } catch (eh) {}
        if (au.hostname === 'gatorvaultinsider.com' || au.hostname === 'www.gatorvaultinsider.com' ||
            au.hostname === 'localhost' || au.hostname === '127.0.0.1' ||
            (siteHost && au.hostname === siteHost)) {
          return (au.pathname || '/') + au.search + au.hash;
        }
      } catch (eRel) {}
      return href;
    }

    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var attr = a.getAttribute('href');
      if (!attr || attr.charAt(0) === '#' ||
          attr.indexOf('mailto:') === 0 || attr.indexOf('tel:') === 0) return;
      var raw = toAppRelative(attr);
      if (raw.indexOf('http') === 0) return;

      if (bundledNative) {
        try {
          var u = new URL(raw, SITE);
          if (isMarketingPath(u.pathname)) {
            e.preventDefault();
            e.stopPropagation();
            location.href = vaultDest();
            return;
          }
          // Deep catch-all routes have no per-slug index.html — every player slug.
          if (isCatchAllDynamic(u.pathname) || isCatchAllDynamic(resolveSpaHref(raw))) {
            e.preventDefault();
            e.stopPropagation();
            navigateCatchAll(raw);
            return;
          }
          // Other vault boards: leave client router alone after hydration.
          if (isVaultClientNav(raw)) return;
        } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
        location.href = abs(norm(raw));
        return;
      }

      var fixed = norm(raw);
      if (fixed !== raw || attr !== raw) {
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

    // Safe-area / tap polish before React mounts.
    try { document.documentElement.classList.add('gv-native-app'); } catch (eCls) {}

    // Restore stashed catch-all deep links BEFORE cold-start routing.
    // Otherwise Team → /vault/players/:slug loads the shell, then cold-start
    // replaces to /vault/ and drops the player (or falls through to marketing).
    consumeSpaPending();
    var path = routePath(location.pathname || '/');
    var cold = takeColdStart();
    if (isMarketingPath(path) || (cold && isMarketingPath(path))) {
      // Skip Preferences round-trip when localStorage already has a session.
      if (sessionOk()) {
        var destFast = vaultDest();
        if (location.href !== destFast) location.replace(destFast);
      } else {
        restoreSessionFromPreferences(function() {
          var dest = vaultDest();
          if (location.href !== dest) location.replace(dest);
        });
      }
    }
  } catch (e) {}
})();`;
