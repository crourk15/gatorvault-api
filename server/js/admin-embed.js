/**
 * Unified admin session for hub iframe modules and legacy admin pages.
 * - Reads PIN from parent postMessage, URL ?pin=, or sessionStorage (gv_admin_pin / gv_ops_pin)
 * - Never prompts twice when hub session is already valid
 */
(function (global) {
  var SESSION_KEY = 'gv_admin_pin';
  var OPS_KEY = 'gv_ops_pin';
  var params = new URLSearchParams(location.search);
  var embedMode = params.get('embed') === '1';
  var readyCallbacks = [];
  var pinApplied = false;

  function getPin() {
    var fromInput = document.getElementById('pin');
    if (fromInput && fromInput.value && fromInput.value.trim()) {
      return fromInput.value.trim();
    }
    var fromGate = document.getElementById('gate-pin');
    if (fromGate && fromGate.value && fromGate.value.trim()) {
      return fromGate.value.trim();
    }
    return (
      sessionStorage.getItem(SESSION_KEY) ||
      sessionStorage.getItem(OPS_KEY) ||
      params.get('pin') ||
      ''
    );
  }

  function setPin(p) {
    p = String(p || '').trim();
    if (!p) return;
    sessionStorage.setItem(SESSION_KEY, p);
    sessionStorage.setItem(OPS_KEY, p);
    ['pin', 'gate-pin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = p;
    });
  }

  function unlockUi() {
    ['admin-pin-gate', 'pin-gate'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    ['admin-app', 'app'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    });
  }

  function runReadyCallbacks(p) {
    readyCallbacks.forEach(function (cb) {
      try {
        cb(p);
      } catch (e) {
        console.warn('[admin-embed] ready callback failed', e);
      }
    });
  }

  function applyPin(pin, opts) {
    opts = opts || {};
    pin = String(pin || '').trim();
    if (!pin) return false;
    setPin(pin);
    unlockUi();
    pinApplied = true;
    if (typeof global.__gvAdminEmbedUnlock === 'function') {
      try {
        global.__gvAdminEmbedUnlock(pin);
      } catch (e) {
        console.warn('[admin-embed] __gvAdminEmbedUnlock failed', e);
      }
    }
    document.dispatchEvent(new CustomEvent('gv-admin-embed-unlock', { detail: { pin: pin } }));
    if (!opts.skipCallbacks) runReadyCallbacks(pin);
    return true;
  }

  function trustEmbedPin(pin) {
    if (!embedMode) return false;
    return applyPin(pin, { skipVerify: true });
  }

  function apiBase() {
    var host = (location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    return location.origin;
  }

  function verifyPinRemote(pin, cb) {
    pin = String(pin || '').trim();
    if (!pin) {
      cb(false);
      return;
    }
    var hdrs = {
      'Content-Type': 'application/json',
      'X-Ops-Pin': pin,
      'X-Recruiting-Pin': pin
    };
    var fetchJson = (global.GVAdminApiFetch && global.GVAdminApiFetch.fetchJson) || null;
    var verifyReq = fetchJson
      ? fetchJson(apiBase() + '/api/ops/verify-pin', {
          method: 'POST',
          headers: hdrs,
          credentials: 'omit',
          body: JSON.stringify({ pin: pin })
        })
      : fetch(apiBase() + '/api/ops/verify-pin', {
          method: 'POST',
          headers: hdrs,
          credentials: 'omit',
          body: JSON.stringify({ pin: pin })
        }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); });

    verifyReq
      .then(function (j) {
        if (j && j.ok) {
          cb(true);
          return;
        }
        var statusReq = fetchJson
          ? fetchJson(apiBase() + '/api/ops/status?pin=' + encodeURIComponent(pin), {
              headers: hdrs,
              credentials: 'omit'
            })
          : fetch(apiBase() + '/api/ops/status?pin=' + encodeURIComponent(pin), {
              headers: hdrs,
              credentials: 'omit'
            }).then(function (r) {
              return r.json().catch(function () { return { ok: false }; });
            });
        return statusReq.then(function (j2) { cb(!!(j2 && j2.ok)); });
      })
      .catch(function (err) {
        cb(false, err && err.message ? err.message : null);
      });
  }

  function bootstrapSession() {
    var urlPin = params.get('pin');
    var saved = getPin();
    if (embedMode) {
      if (urlPin) trustEmbedPin(urlPin);
      else if (saved) trustEmbedPin(saved);
      return;
    }
    if (saved) applyPin(saved);
  }

  if (embedMode) {
    document.documentElement.classList.add('admin-embed');
    var style = document.createElement('style');
    style.textContent = [
      '.admin-embed #admin-pin-gate,',
      '.admin-embed #pin-gate,',
      '.admin-embed .admin-pin-ov,',
      '.admin-embed .pin-gate,',
      '.admin-embed header,',
      '.admin-embed .nav,',
      '.admin-embed body > .wrap > p:last-child a[href*="/admin"],',
      '.admin-embed .wrap > p:last-child,',
      '.admin-embed #app > header,',
      '.admin-embed #app > main > .nav,',
      '.admin-embed body > .wrap:first-child h1:first-child{display:none}',
      '.admin-embed body > .wrap > .sub:first-of-type{display:none}',
      '.admin-embed #app,',
      '.admin-embed #admin-app{display:block!important}'
    ].join('\n') + '{display:none!important}';
    document.head.appendChild(style);
  }

  global.GVAdminEmbed = {
    SESSION_KEY: SESSION_KEY,
    OPS_KEY: OPS_KEY,
    isEmbed: embedMode,
    getPin: getPin,
    setPin: setPin,
    applyPin: applyPin,
    verifyPin: verifyPinRemote,
    apiBase: apiBase,
    fetchJson: function (url, opts) {
      if (global.GVAdminApiFetch && global.GVAdminApiFetch.fetchJson) {
        return global.GVAdminApiFetch.fetchJson(url, opts);
      }
      return fetch(url, opts || {}).then(function (r) {
        return r.text().then(function (text) {
          var trimmed = String(text || '').trim();
          if (trimmed.charAt(0) === '<') {
            throw new Error('API unavailable (' + r.status + '). Render may be waking — retry in 30s.');
          }
          var body = trimmed ? JSON.parse(trimmed) : {};
          if (!r.ok) throw new Error((body && body.error) || ('HTTP ' + r.status));
          return body;
        });
      });
    },
    whenReady: function (fn) {
      if (typeof fn !== 'function') return;
      readyCallbacks.push(fn);
      if (pinApplied) fn(getPin());
      else {
        var p = getPin();
        if (p) applyPin(p);
      }
    },
    wirePin: function (inputEl, onReady) {
      if (typeof onReady === 'function') {
        global.GVAdminEmbed.whenReady(onReady);
      }
      if (inputEl && getPin()) inputEl.value = getPin();
    }
  };

  global.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'gv-admin-pin') return;
    if (embedMode) trustEmbedPin(e.data.pin);
    else applyPin(e.data.pin);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapSession);
  } else {
    bootstrapSession();
  }

  if (embedMode && global.parent !== global) {
    global.parent.postMessage({ type: 'gv-admin-embed-ready' }, '*');
  }
})(window);
