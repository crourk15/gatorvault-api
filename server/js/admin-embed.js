/**
 * Admin embed mode — child pages loaded inside the unified admin hub.
 * Hides duplicate chrome/PIN gates; receives PIN from parent via postMessage.
 */
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('embed') !== '1') return;

  document.documentElement.classList.add('admin-embed');

  var style = document.createElement('style');
  style.textContent = [
    '.admin-embed #admin-pin-gate,',
    '.admin-embed #pin-gate,',
    '.admin-embed .admin-pin-ov,',
    '.admin-embed .pin-gate,',
    '.admin-embed header,',
    '.admin-embed .nav,',
    '.admin-embed body > .wrap > p:last-child a[href*="/admin"]',
    '.admin-embed .wrap > p:last-child',
    '.admin-embed #app > header',
    '.admin-embed #app > main > .nav',
    '.admin-embed #app.hidden,',
    '.admin-embed #admin-app.hidden{display:block!important}',
    '.admin-embed #app{display:block!important}',
    '.admin-embed #admin-app{display:block!important}',
    '.admin-embed body > .wrap:first-child h1:first-child{display:none}',
    '.admin-embed body > .wrap > .sub:first-of-type{display:none}'
  ].join('\n') + '{display:none!important}';
  document.head.appendChild(style);

  function applyPin(pin) {
    if (!pin) return;
    sessionStorage.setItem('gv_admin_pin', pin);
    sessionStorage.setItem('gv_ops_pin', pin);
    ['pin', 'gate-pin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = pin;
    });
    ['admin-pin-gate', 'pin-gate', 'admin-app', 'app'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id.indexOf('gate') >= 0) el.classList.add('hidden');
      else el.classList.remove('hidden');
    });
    if (typeof window.__gvAdminEmbedUnlock === 'function') {
      try { window.__gvAdminEmbedUnlock(pin); } catch (e) { /* ignore */ }
    }
    document.dispatchEvent(new CustomEvent('gv-admin-embed-unlock', { detail: { pin: pin } }));
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'gv-admin-pin') return;
    applyPin(e.data.pin);
  });

  var parentPin = params.get('pin');
  if (parentPin) applyPin(parentPin);

  if (window.parent !== window) {
    window.parent.postMessage({ type: 'gv-admin-embed-ready' }, '*');
  }
})();
