/**
 * GatorVault Unified Admin Hub — auth, routing, iframe panels.
 */
(function (global) {
  var SESSION_KEY = 'gv_admin_pin';
  var OPS_SESSION_KEY = 'gv_ops_pin';

  function resolveAdminApiBase() {
    var host = (location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    // Same-origin — Netlify/_redirects proxy /api/* to Render (see netlify.toml).
    return location.origin;
  }

  var API = resolveAdminApiBase();
  var _hubInitialized = false;
  var _moduleHealth = {};
  var _healthPollTimer = null;

  var EMBED_SRC = {
    ops: '/admin-ops.html?embed=1',
    qa: '/admin-qa.html?embed=1',
    'qa-mobile': '/admin-qa-mobile.html?embed=1',
    'product-intel': '/admin-product-intel.html?embed=1',
    'self-runner': '/admin-self-runner.html?embed=1',
    feedback: '/admin-feedback.html?embed=1',
    monitoring: '/admin-monitoring.html?embed=1',
    'recruiting-alerts': '/recruiting-admin.html?embed=1',
    'player-intel': '/player-intel-entry.html?embed=1',
    board: '/recruiting-board.html?embed=1',
    content: '/content-admin.html?embed=1',
    community: '/community-admin.html?embed=1',
    gm2: '/admin-ops-gm2.html?embed=1',
    identity: '/admin-ops-identity-patterns.html?embed=1'
  };

  var LEGACY_PATHS = {
    '/admin/qa': { section: 'qa', panel: 'monitor' },
    '/admin-qa.html': { section: 'qa', panel: 'monitor' },
    '/admin/qa/mobile-behavior': { section: 'qa', panel: 'mobile-behavior' },
    '/admin-qa-mobile.html': { section: 'qa', panel: 'mobile-behavior' },
    '/admin/product-health': { section: 'product-intel', panel: 'health' },
    '/admin-product-intel.html': { section: 'product-intel', panel: 'health' },
    '/admin/self-runner': { section: 'self-runner', panel: 'pending' },
    '/admin-self-runner.html': { section: 'self-runner', panel: 'pending' },
    '/admin/ops': { section: 'dashboard', panel: 'ops' },
    '/admin/feedback': { section: 'feedback', panel: 'inbox' },
    '/admin/monitoring': { section: 'recruiting', panel: 'monitoring-full' },
    '/admin/ops/gm2': { section: 'gm2', panel: 'integrity' },
    '/admin/ops/gm2/rerun': { section: 'dashboard', panel: 'runbooks' },
    '/admin/ops/identity-patterns': { section: 'gm2', panel: 'identity' },
    '/vault/ops': { section: 'dashboard', panel: 'ops' },
    '/recruiting-admin.html': { section: 'recruiting', panel: 'alerts-full' },
    '/recruiting-board.html': { section: 'team', panel: 'board' },
    '/content-admin.html': { section: 'content', panel: 'content-accuracy' },
    '/community-admin.html': { section: 'community', panel: 'moderation' }
  };

  var SECTIONS = [
    {
      id: 'beat-desk',
      label: 'Beat Desk',
      mark: 'BD',
      group: 'primary',
      desc: 'Daily desk — beat intel → player packet → Copy Brief → X',
      panels: [{ id: 'desk', label: 'Brief Desk', inline: true }]
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      mark: 'CC',
      group: 'primary',
      desc: 'Command center — system health, top issues, pipelines, recommended actions',
      panels: [
        { id: 'overview', label: 'Command Center', inline: true },
        { id: 'runbooks', label: 'Runbooks', inline: true },
        { id: 'ops-summary', label: 'Ops Summary', inline: true },
        { id: 'jobs', label: 'Job Queue', inline: true },
        { id: 'post-studio', label: 'Post Studio (advanced)', inline: true },
        { id: 'ops', label: 'Full Ops', embed: 'ops' }
      ]
    },
    {
      id: 'members',
      label: 'Members',
      mark: 'MB',
      group: 'primary',
      desc: 'Newest signups — trial, paid, and expired accounts',
      panels: [{ id: 'recent', label: 'Recent Members', inline: true }]
    },
    {
      id: 'futurecast',
      label: 'FutureCast',
      mark: 'FC',
      group: 'primary',
      desc: 'Targets, 2028 admin allowlist, early watch — what Beat Desk seeds into FutureCast',
      panels: [{ id: 'control', label: 'Targets & Allowlist', inline: true }]
    },
    {
      id: 'recruiting',
      label: 'Recruiting Admin',
      mark: 'RH',
      group: 'primary',
      desc: 'Daily pipeline, unresolved RPM teasers, alerts, monitoring, Vault Grades',
      panels: [
        { id: 'daily', label: 'Daily Summary', inline: true },
        { id: 'unresolved', label: 'Unresolved Predictions', inline: true },
        { id: 'alerts', label: 'Alerts Summary', inline: true },
        { id: 'monitoring', label: 'Monitoring Summary', inline: true },
        { id: 'vault-grades', label: 'Vault Grades Manager', inline: true },
        { id: 'alerts-full', label: 'Full Alerts (legacy)', embed: 'recruiting-alerts' },
        { id: 'monitoring-full', label: 'Full Monitoring (legacy)', embed: 'monitoring' }
      ]
    },
    {
      id: 'team',
      label: 'Team Admin',
      mark: 'TM',
      group: 'primary',
      desc: 'Roster & board editor + Vault Grades (depth/staff live on the public Team vault)',
      panels: [
        { id: 'board', label: 'Roster & Board', inline: true },
        { id: 'board-full', label: 'Full Board', inline: true },
        { id: 'vault-grades', label: 'Vault Grades Manager', inline: true }
      ]
    },
    {
      id: 'gm2',
      label: 'GM',
      mark: 'GM',
      group: 'primary',
      desc: 'GM integrity checks + identity patterns (runbooks live under Dashboard)',
      panels: [
        { id: 'integrity', label: 'GM Integrity', embed: 'gm2' },
        { id: 'identity', label: 'Identity Patterns', embed: 'identity' }
      ]
    },
    {
      id: 'product-intel',
      label: 'Product Health',
      mark: 'PI',
      group: 'primary',
      desc: 'API uptime, latency, error rates, deploy status, fix queue',
      panels: [
        { id: 'summary', label: 'Fix Queue', inline: true },
        { id: 'health', label: 'Full console', embed: 'product-intel' }
      ]
    },
    {
      id: 'qa',
      label: 'QA Monitor',
      mark: 'QA',
      group: 'primary',
      desc: '24/7 crawler — pass/fail, broken pages, UX integrity',
      panels: [
        { id: 'summary', label: 'QA Summary', inline: true },
        { id: 'monitor', label: 'Full QA', embed: 'qa' },
        { id: 'mobile-behavior', label: 'Mobile Behavior', embed: 'qa-mobile' }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      mark: 'ST',
      group: 'primary',
      desc: 'Member points, tiers, film/live rebuild tools, PIN env reference (no feature-flag UI yet)',
      panels: [{ id: 'platform', label: 'Platform Settings', inline: true }]
    },
    {
      id: 'content',
      label: 'Content & Media',
      mark: 'CM',
      group: 'legacy',
      desc: 'Legacy iframe — articles / content accuracy escape hatch',
      panels: [
        { id: 'content-accuracy', label: 'Content Accuracy', embed: 'content' },
        { id: 'insider-articles', label: 'Insider Articles', embed: 'ops', hash: '#insider-articles' }
      ]
    },
    {
      id: 'community',
      label: 'Community Admin',
      mark: 'CO',
      group: 'legacy',
      desc: 'Legacy iframe — moderation queue escape hatch',
      panels: [{ id: 'moderation', label: 'Moderation Queue', embed: 'community' }]
    },
    {
      id: 'feedback',
      label: 'Feedback & Support',
      mark: 'FB',
      group: 'legacy',
      desc: 'Legacy iframe — feedback inbox escape hatch',
      panels: [{ id: 'inbox', label: 'Feedback Inbox', embed: 'feedback' }]
    },
    {
      id: 'player-intel',
      label: 'Player Intel Entry',
      mark: 'PX',
      group: 'legacy',
      desc: 'Legacy iframe — prefer Beat Desk for daily intel → board',
      panels: [{ id: 'entry', label: 'Intel Entry', embed: 'player-intel' }]
    },
    {
      id: 'self-runner',
      label: 'Self-Runner',
      mark: 'SR',
      group: 'legacy',
      desc: 'Legacy iframe — automation pending-fixes console',
      panels: [{ id: 'pending', label: 'Pending Fixes', embed: 'self-runner' }]
    }
  ];

  function loginUrl() {
    var next = location.pathname + (location.hash || '#beat-desk/desk');
    return '/admin/login?next=' + encodeURIComponent(next);
  }

  function redirectToLogin() {
    location.replace(loginUrl());
  }

  function healthDotClass(status) {
    if (status === 'red') return 'hub-health-red';
    if (status === 'yellow') return 'hub-health-yellow';
    if (status === 'green') return 'hub-health-green';
    return 'hub-health-unknown';
  }

  function applyModuleHealth(map) {
    _moduleHealth = map || {};
    document.querySelectorAll('.hub-nav-btn').forEach(function (btn) {
      var id = btn.getAttribute('data-section');
      var dot = btn.querySelector('.hub-health-dot');
      if (!dot) return;
      var st = _moduleHealth[id] || 'unknown';
      dot.className = 'hub-health-dot ' + healthDotClass(st);
      dot.title = 'Status: ' + st;
    });
    var envEl = document.getElementById('hub-env-badge');
    if (envEl && _moduleHealth._environment) {
      envEl.textContent = _moduleHealth._environment === 'prod' ? 'Prod' : 'Stage';
      envEl.className = 'hub-env-badge ' + (_moduleHealth._environment === 'prod' ? 'hub-env-prod' : 'hub-env-stage');
    }
    var alertBtn = document.getElementById('hub-alerts-btn');
    if (alertBtn && _moduleHealth._alertCount != null) {
      var n = _moduleHealth._alertCount;
      alertBtn.setAttribute('data-count', n > 0 ? String(n) : '');
      alertBtn.title = n > 0 ? (n + ' alert(s)') : 'No alerts';
    }
  }

  function pollModuleHealth() {
    if (!pin()) return;
    apiGet('/api/admin/hub/module-health')
      .then(function (j) {
        showApiBanner(null);
        var health = (j && (j.moduleHealth || j.modules)) || null;
        if (health) {
          var merged = Object.assign({}, health);
          merged._environment = j.environment;
          merged._alertCount = j.alertCount;
          applyModuleHealth(merged);
        }
      })
      .catch(function (err) {
        showApiBanner((err && err.message) || 'Admin Hub API unreachable — Render may be waking.');
      });
    // Keep the sticky ops strip fresh even when Command Center is not open.
    apiGet('/api/admin/hub/overview')
      .then(function (overview) { applyOpsStrip(overview); })
      .catch(function () { /* strip stays as-is */ });
  }

  function startHealthPoll() {
    pollModuleHealth();
    if (_healthPollTimer) clearInterval(_healthPollTimer);
    _healthPollTimer = setInterval(pollModuleHealth, 60000);
  }

  function navigateFromHash(routeStr) {
    if (!routeStr) return;
    var r = String(routeStr).replace(/^#/, '');
    var parts = r.split('/');
    setRoute(parts[0] || 'dashboard', parts[1] || null);
    renderRoute();
  }

  function wireGlobalSearch() {
    var input = document.getElementById('hub-global-search');
    var resultsEl = document.getElementById('hub-search-results');
    if (!input || !resultsEl) return;
    var timer = null;

    function hideResults() {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
    }

    function renderResults(items) {
      if (!items || !items.length) {
        resultsEl.innerHTML = '<div class="hub-search-empty">No results</div>';
        resultsEl.classList.remove('hidden');
        return;
      }
      resultsEl.innerHTML = items.map(function (item) {
        var route = item.route || '';
        var type = item.type || 'item';
        return '<button type="button" class="hub-search-item" data-route="' + route + '" data-href="' + (item.href || '') + '">'
          + '<span class="hub-search-type">' + type + '</span>'
          + '<strong>' + (item.title || item.name || item.id) + '</strong>'
          + (item.subtitle ? '<span>' + item.subtitle + '</span>' : '')
          + '</button>';
      }).join('');
      resultsEl.classList.remove('hidden');
      resultsEl.querySelectorAll('.hub-search-item').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          var href = btn.getAttribute('data-href');
          var route = btn.getAttribute('data-route');
          hideResults();
          input.value = '';
          // Cmd/Ctrl-click opens public vault URL when available.
          if (href && (ev.metaKey || ev.ctrlKey)) {
            window.open(href, '_blank', 'noopener');
            return;
          }
          if (route) navigateFromHash(route);
          else if (href) window.open(href, '_blank', 'noopener');
        });
      });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { hideResults(); return; }
      timer = setTimeout(function () {
        apiGet('/api/admin/hub/search?q=' + encodeURIComponent(q))
          .then(function (j) {
            var list = [];
            if (j.results) {
              if (j.results.players) list = list.concat(j.results.players);
              if (j.results.articles) list = list.concat(j.results.articles);
              if (j.results.users) list = list.concat(j.results.users);
              if (Array.isArray(j.results)) list = j.results;
            }
            renderResults(list);
          })
          .catch(function () { hideResults(); });
      }, 250);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideResults();
    });

    document.addEventListener('click', function (e) {
      if (!resultsEl.contains(e.target) && e.target !== input) hideResults();
    });
  }

  function wireAlertsPanel() {
    var btn = document.getElementById('hub-alerts-btn');
    var panel = document.getElementById('hub-alerts-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      if (panel.classList.contains('hidden')) return;
      panel.innerHTML = '<p class="hub-meta">Loading alerts…</p>';
      apiGet('/api/admin/hub/overview')
        .then(function (j) {
          var alerts = (j && j.alerts && j.alerts.alerts) || (Array.isArray(j.alerts) ? j.alerts : []);
          if (!alerts.length) {
            panel.innerHTML = '<p class="hub-meta">No active alerts</p>';
            return;
          }
          panel.innerHTML = alerts.map(function (a) {
            return '<div class="hub-alert-item">'
              + '<strong>' + (a.title || a.message || 'Alert') + '</strong>'
              + (a.detail || a.message ? '<span>' + (a.detail || a.message) + '</span>' : '')
              + '</div>';
          }).join('');
        })
        .catch(function (e) {
          panel.innerHTML = '<p class="err">' + e.message + '</p>';
        });
    });
  }

  function pin() {
    return sessionStorage.getItem(SESSION_KEY) || '';
  }

  function showApiBanner(message) {
    var el = document.getElementById('hub-api-banner');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    // Soften scary wake copy — retries happen quietly in GVAdminApiFetch.
    var soft = String(message || '');
    if (/unavailable|waking|warming|502|503|504|HTML instead of JSON|Kitchen busy|kitchen/i.test(soft)) {
      soft = 'Waking kitchen… hang tight.';
    }
    el.textContent = soft;
    el.classList.remove('hidden');
  }

  function parseApiResponse(r) {
    var fetchApi = global.GVAdminApiFetch;
    if (fetchApi && fetchApi.parseApiResponse) {
      return r.text().then(function (text) {
        return fetchApi.parseApiResponse(r, text, API);
      });
    }
    return r.text().then(function (text) {
      var j = null;
      try { j = text ? JSON.parse(text) : {}; } catch (e) {
        throw new Error(text ? text.slice(0, 200) : ('HTTP ' + r.status));
      }
      if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
      return j;
    });
  }

  function apiPost(path, body, postOpts) {
    var p = pin();
    if (!p) return Promise.reject(new Error('Admin PIN required'));
    postOpts = postOpts || {};
    var opts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Recruiting-Pin': p,
        'X-Ops-Pin': p,
        'X-Roster-Pin': p
      },
      body: JSON.stringify(Object.assign({ pin: p }, body || {})),
      retries: postOpts.retries,
      retryDelayMs: postOpts.retryDelayMs,
      onAttempt: postOpts.onAttempt,
      skipWake: postOpts.skipWake
    };
    var fetchApi = global.GVAdminApiFetch;
    if (fetchApi && fetchApi.fetchJsonAwake) {
      return fetchApi.fetchJsonAwake(API + path, opts);
    }
    if (fetchApi && fetchApi.fetchJson) {
      return fetchApi.fetchJson(API + path, opts);
    }
    return fetch(API + path, opts).then(parseApiResponse);
  }

  function apiGet(path, getOpts) {
    var p = pin();
    if (!p) return Promise.reject(new Error('Admin PIN required'));
    getOpts = getOpts || {};
    var opts = {
      headers: { 'X-Recruiting-Pin': p, 'X-Ops-Pin': p, 'X-Roster-Pin': p },
      retries: getOpts.retries,
      retryDelayMs: getOpts.retryDelayMs,
      onAttempt: getOpts.onAttempt,
      skipWake: getOpts.skipWake
    };
    var fetchApi = global.GVAdminApiFetch;
    // Wake kitchen once, then hit the real route — kills cold-start 502 loops.
    if (fetchApi && fetchApi.fetchJsonAwake) {
      return fetchApi.fetchJsonAwake(API + path, opts);
    }
    if (fetchApi && fetchApi.fetchJson) {
      return fetchApi.fetchJson(API + path, opts);
    }
    return fetch(API + path, opts).then(parseApiResponse);
  }

  function adminPinHeaders(p) {
    return { 'X-Ops-Pin': p, 'X-Recruiting-Pin': p };
  }

  function responseLooksLikeHtml(text) {
    var t = String(text || '').trim();
    return t.indexOf('<!DOCTYPE') === 0 || t.indexOf('<html') === 0;
  }

  function infraResponseError(status, text) {
    var err = new Error(
      'API unavailable (HTTP ' + status + '). Received HTML instead of JSON — the /api proxy or Render backend may be down.'
    );
    err.isInfra = true;
    return err;
  }

  function parseVerifyPinBody(r, text) {
    if (responseLooksLikeHtml(text)) throw infraResponseError(r.status, text);
    var j = {};
    try {
      j = text ? JSON.parse(text) : {};
    } catch (e) {
      throw infraResponseError(r.status, text);
    }
    if (r.ok && j && j.ok) return true;
    if (r.status === 401) return false;
    return null;
  }

  function verifyPinViaStatus(p) {
    return fetch(API + '/api/ops/status', {
      method: 'GET',
      headers: adminPinHeaders(p),
      credentials: 'omit'
    }).then(function (r) {
      return r.text().then(function (text) {
        if (responseLooksLikeHtml(text)) throw infraResponseError(r.status, text);
        var j = {};
        try {
          j = text ? JSON.parse(text) : {};
        } catch (e) {
          throw infraResponseError(r.status, text);
        }
        return !!(r.ok && j && j.ok);
      });
    });
  }

  function verifyPin(p, cb) {
    p = String(p || '').trim();
    if (!p) {
      cb(false);
      return;
    }
    var hdrs = Object.assign({ 'Content-Type': 'application/json' }, adminPinHeaders(p));
    fetch(API + '/api/ops/verify-pin', {
      method: 'POST',
      headers: hdrs,
      credentials: 'omit',
      body: JSON.stringify({ pin: p })
    })
      .then(function (r) {
        return r.text().then(function (text) {
          if (r.status === 404) return verifyPinViaStatus(p);
          var parsed = parseVerifyPinBody(r, text);
          if (parsed === true) return true;
          if (parsed === false) return false;
          return verifyPinViaStatus(p);
        });
      })
      .catch(function (err) {
        if (err && err.isInfra) throw err;
        return verifyPinViaStatus(p);
      })
      .then(function (ok) { cb(!!ok); })
      .catch(function (err) { cb(false, err && err.message ? err.message : null); });
  }

  function panelSrc(panel) {
    if (!panel || !panel.embed) return '';
    var base = EMBED_SRC[panel.embed] || '';
    return base + (panel.hash || '');
  }

  function resolveLegacyPath() {
    var p = location.pathname.replace(/\/$/, '') || '/admin';
    var leg = LEGACY_PATHS[p];
    if (leg && !location.hash) {
      location.replace('/admin/hub#' + leg.section + (leg.panel ? '/' + leg.panel : ''));
      return true;
    }
    return false;
  }

  function findSection(id) {
    return SECTIONS.find(function (s) { return s.id === id; }) || SECTIONS[0];
  }

  function parseRoute() {
    var hash = (location.hash || '#beat-desk/desk').replace(/^#/, '');
    if (hash === 'qa' || hash === 'dashboard/qa') {
      return { section: 'qa', panel: 'monitor' };
    }
    if (hash === 'product-health' || hash === 'dashboard/product-health') {
      return { section: 'product-intel', panel: 'health' };
    }
    // Legacy Settings → Members tab (pre top-level Members nav)
    if (hash === 'settings/members' || hash === 'members') {
      return { section: 'members', panel: 'recent' };
    }
    var parts = hash.split('/');
    var section = parts[0] || 'beat-desk';
    var panel = parts[1] || null;
    if (section === 'beat-desk' && !panel) panel = 'desk';
    if (section === 'dashboard' && !panel) panel = 'overview';
    if (section === 'members' && !panel) panel = 'recent';
    return { section: section, panel: panel };
  }

  function setRoute(sectionId, panelId) {
    var hash = panelId ? ('#' + sectionId + '/' + panelId) : ('#' + sectionId);
    if (location.hash !== hash) location.hash = hash;
  }

  function postPinToIframe(iframe) {
    if (!iframe || !iframe.contentWindow) return;
    var p = pin();
    if (!p) return;
    // Same-origin only — never broadcast PIN with target '*'.
    var target = location.origin || '*';
    try {
      iframe.contentWindow.postMessage({ type: 'gv-admin-pin', pin: p }, target);
    } catch (e) {
      /* cross-origin blocked — sessionStorage still shared for same-origin embeds */
    }
  }

  function ensureEmbedNotice(panelEl) {
    if (!panelEl || panelEl.querySelector('.hub-embed-notice')) return;
    var notice = document.createElement('div');
    notice.className = 'hub-embed-notice';
    notice.setAttribute('role', 'note');
    notice.textContent =
      'Legacy console embed — prefer Daily Summary / in-shell panels for the daily path. Full consoles stay available as an escape hatch.';
    panelEl.insertBefore(notice, panelEl.firstChild);
  }

  function loadIframe(panelEl, src) {
    ensureEmbedNotice(panelEl);
    var iframe = panelEl.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'hub-iframe';
      iframe.title = 'Admin panel';
      iframe.setAttribute('loading', 'lazy');
      panelEl.appendChild(iframe);
    }
    // Do not put PIN in the iframe URL (history / Referer leak).
    // Embeds read sessionStorage + postMessage instead.
    var fullSrc = src;
    if (iframe.getAttribute('data-src') !== fullSrc) {
      iframe.setAttribute('data-src', fullSrc);
      iframe.src = fullSrc;
    }
    iframe.onload = function () {
      showApiBanner(null);
      postPinToIframe(iframe);
      var attempts = 0;
      var timer = setInterval(function () {
        postPinToIframe(iframe);
        attempts += 1;
        if (attempts >= 8) clearInterval(timer);
      }, 250);
    };
    iframe.onerror = function () {
      showApiBanner('Embedded admin panel failed to load. Use Daily Summary or refresh.');
    };
    postPinToIframe(iframe);
  }

  function renderVaultGradesPanel(container) {
    container.innerHTML = ''
      + '<div class="hub-section-head">'
      + '<h2>Vault Grades Manager</h2>'
      + '<p>Override Vault Grades for roster and recruiting players. Changes apply instantly across Top Gators, Recruiting Board, War Room, and Player Profiles.</p>'
      + '</div>'
      + '<div id="vault-grade-editor-root"></div>';

    var root = document.getElementById('vault-grade-editor-root');
    if (!root || !global.VaultGradeEditor) {
      if (root) {
        root.innerHTML = '<p class="hub-meta err">VaultGradeEditor failed to load. Refresh the page.</p>';
      }
      return;
    }
    VaultGradeEditor.mount(root, {
      apiGet: apiGet,
      apiPost: apiPost,
      pin: pin
    });
  }

  function renderRunbooksPanel(container) {
    if (global.GVAdminRunbooks && typeof global.GVAdminRunbooks.render === 'function') {
      global.GVAdminRunbooks.render(container, {
        apiGet: apiGet,
        apiPost: apiPost,
        pin: pin,
        onNavigate: navigateFromHash
      });
      return;
    }
    container.innerHTML = '<p class="hub-meta err">Runbooks failed to load. Refresh the page.</p>';
  }

  function renderGmRerunPanel(container) {
    // Legacy GM "Re-run Modules" tab now hosts the shared Runbooks UI.
    renderRunbooksPanel(container);
  }

  function renderSettingsPanel(container) {
    container.innerHTML = ''
      + '<div class="hub-settings-grid">'
      + '<div class="hub-card hub-card-wide"><h3>What Settings covers today</h3>'
      + '<p class="hub-meta" style="margin:0;color:#e2e8f0">Member points, tier lookup, and kitchen rebuild tools. There is <strong style="color:#fff">no feature-flag UI</strong> and no admin-user manager yet — those stay in Render env / code.</p>'
      + '</div>'
      + '<div class="hub-card"><h3>Member Points</h3>'
      + '<label>Member email</label><input id="hub-pts-email" type="email" placeholder="member@example.com">'
      + '<button type="button" class="hub-btn secondary" id="hub-pts-lookup">Look Up</button>'
      + '<p id="hub-pts-current" class="hub-meta"></p>'
      + '<label>Set total points</label><input id="hub-pts-set" type="number" min="0" placeholder="500">'
      + '<button type="button" class="hub-btn" id="hub-pts-save">Set Points</button>'
      + '<label>Award bonus</label><input id="hub-pts-award" type="number" min="1" max="5000" placeholder="50">'
      + '<button type="button" class="hub-btn secondary" id="hub-pts-award-btn">Award Points</button>'
      + '</div>'
      + '<div class="hub-card"><h3>Tier Definitions</h3>'
      + '<button type="button" class="hub-btn secondary" id="hub-load-tiers">Load Tiers</button>'
      + '<ul id="hub-tier-list" class="hub-tier-list"></ul>'
      + '</div>'
      + '<div class="hub-card"><h3>Film Room &amp; Live</h3>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn" data-hub-action="film-rebuild">Rebuild Film Room</button>'
      + '<button type="button" class="hub-btn secondary" data-hub-action="purge-beat">Purge Non-UF Beat</button>'
      + '<button type="button" class="hub-btn secondary" data-hub-action="scouting-rebuild">Rebuild Scouting DB</button>'
      + '</div></div>'
      + '<div class="hub-card"><h3>PIN env reference</h3>'
      + '<p class="hub-meta">Set on Render: <code>OPS_ADMIN_PIN</code>, <code>RECRUITING_ADMIN_PIN</code>, <code>CONTENT_ADMIN_PIN</code>, <code>COMMUNITY_ADMIN_PIN</code>, <code>LIVE_ADMIN_PIN</code></p>'
      + '<p class="hub-meta">Coach identity: <code>official-names.json</code>. Branding/theme controls are not in this panel.</p>'
      + '</div>'
      + '<div class="hub-card hub-card-wide"><h3>Admin Log</h3><div id="hub-log" class="hub-log"></div></div>'
      + '</div>';

    function hubLog(msg, cls) {
      var el = document.getElementById('hub-log');
      if (!el) return;
      var line = document.createElement('div');
      line.className = cls || 'info';
      line.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
      el.prepend(line);
    }

    document.getElementById('hub-pts-lookup').addEventListener('click', function () {
      var email = document.getElementById('hub-pts-email').value.trim();
      if (!email) return;
      apiGet('/api/points/admin/lookup?email=' + encodeURIComponent(email))
        .then(function (j) {
          document.getElementById('hub-pts-current').textContent = j.email + ': ' + j.points + ' pts (' + j.tier + ')';
          document.getElementById('hub-pts-set').value = j.points;
          hubLog('Lookup OK — ' + j.points + ' pts', 'ok');
        }).catch(function (e) { hubLog(e.message, 'err'); });
    });

    document.getElementById('hub-pts-save').addEventListener('click', function () {
      var email = document.getElementById('hub-pts-email').value.trim();
      var points = parseInt(document.getElementById('hub-pts-set').value, 10);
      if (!email || isNaN(points)) return;
      apiPost('/api/points/admin/set', { email: email, points: points })
        .then(function (j) {
          document.getElementById('hub-pts-current').textContent = j.email + ': ' + j.points + ' pts (' + j.tier + ')';
          hubLog('Points set to ' + j.points, 'ok');
        }).catch(function (e) { hubLog(e.message, 'err'); });
    });

    document.getElementById('hub-pts-award-btn').addEventListener('click', function () {
      var email = document.getElementById('hub-pts-email').value.trim();
      var amount = parseInt(document.getElementById('hub-pts-award').value, 10);
      if (!email || !amount) return;
      apiPost('/api/points/admin/award', { email: email, amount: amount, reason: 'admin award' })
        .then(function (j) {
          document.getElementById('hub-pts-current').textContent = j.email + ': ' + j.points + ' pts (' + j.tier + ')';
          hubLog('Awarded +' + amount, 'ok');
        }).catch(function (e) { hubLog(e.message, 'err'); });
    });

    document.getElementById('hub-load-tiers').addEventListener('click', function () {
      fetch(API + '/api/tiers').then(function (r) { return r.json(); }).then(function (j) {
        var ul = document.getElementById('hub-tier-list');
        ul.innerHTML = '';
        (j.paymentTiers || []).concat(j.pointsTiers || []).forEach(function (t) {
          var li = document.createElement('li');
          li.textContent = (t.icon || '') + ' ' + (t.name || t.id) + (t.minPoints != null ? ' (' + t.minPoints + '+ pts)' : '');
          ul.appendChild(li);
        });
        hubLog('Tiers loaded', 'ok');
      }).catch(function (e) { hubLog(e.message, 'err'); });
    });

    container.querySelectorAll('[data-hub-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-hub-action');
        btn.disabled = true;
        var p;
        if (action === 'film-rebuild') p = apiPost('/api/film-room/admin/rebuild', { scope: 'all' });
        else if (action === 'purge-beat') p = apiPost('/api/live/admin/purge-non-uf-beat', {});
        else if (action === 'scouting-rebuild') p = apiPost('/api/war-room/admin/rebuild-scouting', {});
        else p = Promise.resolve();
        p.then(function (j) { hubLog('Done: ' + JSON.stringify(j).slice(0, 160), 'ok'); })
          .catch(function (e) { hubLog(e.message, 'err'); })
          .finally(function () { btn.disabled = false; });
      });
    });
  }

  function initHub() {
    if (_hubInitialized) {
      renderRoute();
      return;
    }
    _hubInitialized = true;
    var navEl = document.getElementById('hub-nav');
    var mainEl = document.getElementById('hub-main');
    if (!navEl || !mainEl) return;

    var sawLegacy = false;
    SECTIONS.forEach(function (sec) {
      if (sec.group === 'legacy' && !sawLegacy) {
        sawLegacy = true;
        var divider = document.createElement('div');
        divider.className = 'hub-nav-divider';
        divider.setAttribute('role', 'presentation');
        divider.innerHTML = '<span>Legacy consoles</span>';
        navEl.appendChild(divider);
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hub-nav-btn' + (sec.group === 'legacy' ? ' hub-nav-btn--legacy' : '');
      btn.setAttribute('data-section', sec.id);
      btn.innerHTML = '<span class="hub-health-dot hub-health-unknown"></span><span class="hub-nav-mark">' + (sec.mark || sec.label.slice(0, 2).toUpperCase()) + '</span><span class="hub-nav-label">' + sec.label + '</span>';
      btn.addEventListener('click', function () { setRoute(sec.id, sec.panels[0] && sec.panels[0].id); renderRoute(); });
      navEl.appendChild(btn);

      var sectionEl = document.createElement('section');
      sectionEl.className = 'hub-section hidden';
      sectionEl.id = 'hub-section-' + sec.id;
      sectionEl.innerHTML = '<div class="hub-section-head"><h2>' + sec.label + '</h2><p>' + sec.desc + '</p></div>';

      if (sec.panels.length > 1) {
        var tabs = document.createElement('div');
        tabs.className = 'hub-tabs';
        sec.panels.forEach(function (panel, idx) {
          var tab = document.createElement('button');
          tab.type = 'button';
          tab.className = 'hub-tab' + (idx === 0 ? ' active' : '');
          tab.setAttribute('data-section', sec.id);
          tab.setAttribute('data-panel', panel.id);
          tab.textContent = panel.label;
          tab.addEventListener('click', function () {
            setRoute(sec.id, panel.id);
            renderRoute();
          });
          tabs.appendChild(tab);
        });
        sectionEl.appendChild(tabs);
      }

      sec.panels.forEach(function (panel) {
        var panelEl = document.createElement('div');
        panelEl.className = 'hub-panel hidden';
        panelEl.id = 'hub-panel-' + sec.id + '-' + panel.id;
        panelEl.setAttribute('data-section', sec.id);
        panelEl.setAttribute('data-panel', panel.id);
        if (panel.inline) panelEl.setAttribute('data-inline', '1');
        sectionEl.appendChild(panelEl);
      });

      mainEl.appendChild(sectionEl);
    });

    window.addEventListener('hashchange', renderRoute);
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'gv-admin-embed-ready') {
        var frames = document.querySelectorAll('.hub-iframe');
        frames.forEach(postPinToIframe);
      }
    });

    wireGlobalSearch();
    wireAlertsPanel();
    wireOpsStrip();
    wireActivityRail();
    startHealthPoll();
    renderRoute();
  }

  function wireOpsStrip() {
    var primary = document.getElementById('hub-ops-strip-primary');
    var secondary = document.getElementById('hub-ops-strip-secondary');
    if (primary) {
      primary.addEventListener('click', function () {
        var jobId = primary.getAttribute('data-job');
        if (jobId === 'hub-refresh') {
          primary.disabled = true;
          primary.textContent = 'Refreshing…';
          apiGet('/api/admin/hub/overview')
            .then(function (data) {
              applyOpsStrip(data);
              if (global.GVAdminHub && typeof global.GVAdminHub.applyModuleHealth === 'function') {
                global.GVAdminHub.applyModuleHealth(Object.assign({}, data.moduleHealth || {}, {
                  _environment: data.environment
                }));
              }
              // Re-enter overview so Coach reloads with fresh top issue.
              navigateFromHash('#dashboard/overview');
            })
            .catch(function (e) {
              alert((e && e.message) || 'Refresh failed');
            })
            .finally(function () {
              primary.disabled = false;
            });
          return;
        }
        if (jobId) {
          primary.disabled = true;
          var prev = primary.textContent;
          primary.textContent = 'Running…';
          apiPost('/api/ops/run-job', { jobId: jobId })
            .then(function () {
              pushActivity({
                status: 'success',
                message: 'Fix job finished: ' + jobId,
                subsystem: 'ops'
              });
              primary.textContent = 'Done — refreshing';
              return apiGet('/api/admin/hub/overview').then(function (data) {
                applyOpsStrip(data);
                if (global.GVAdminHub && typeof global.GVAdminHub.applyModuleHealth === 'function') {
                  global.GVAdminHub.applyModuleHealth(Object.assign({}, data.moduleHealth || {}, {
                    _environment: data.environment
                  }));
                }
              });
            })
            .catch(function (e) {
              primary.textContent = prev || 'Retry fix';
              pushActivity({
                status: 'error',
                message: (e && e.message) || 'Fix job failed',
                subsystem: 'ops'
              });
              alert((e && e.message) || 'Fix failed — open Ops Summary and try again.');
            })
            .finally(function () {
              primary.disabled = false;
            });
          return;
        }
        var route = primary.getAttribute('data-route') || '#dashboard/runbooks';
        navigateFromHash(route);
      });
    }
    if (secondary) {
      secondary.addEventListener('click', function () {
        navigateFromHash('#dashboard/overview');
      });
    }
  }

  function applyOpsStrip(data) {
    var strip = document.getElementById('hub-ops-strip');
    var titleEl = document.getElementById('hub-ops-strip-title');
    var detailEl = document.getElementById('hub-ops-strip-detail');
    var primary = document.getElementById('hub-ops-strip-primary');
    if (!strip || !titleEl || !detailEl || !primary) return;

    var issues = (data && data.topIssues) || [];
    var top = issues[0];
    strip.classList.remove('hidden');
    primary.removeAttribute('data-job');

    if (!top) {
      titleEl.textContent = 'All clear';
      detailEl.textContent = 'No critical issues — runbooks ready if you need them.';
      primary.textContent = 'Open Runbooks';
      primary.setAttribute('data-route', '#dashboard/runbooks');
      return;
    }

    titleEl.textContent = top.title || 'Attention needed';
    var doNow = (top.coach && top.coach.doThisNow) || top.fixHowTo || '';
    var bits = [];
    if (top.why) bits.push(String(top.why));
    else if (top.detail) bits.push(String(top.detail));
    if (doNow) bits.push('Do this now: ' + String(doNow));
    detailEl.textContent = bits.join(' — ') || 'Follow Coach on Command Center.';
    if (top.actionType) {
      primary.textContent = top.action || 'Run fix';
      primary.setAttribute('data-job', top.actionType);
      primary.setAttribute('data-route', top.route || '#dashboard/overview');
    } else if (top.route) {
      primary.textContent = top.action || 'Open';
      primary.setAttribute('data-route', top.route);
    } else {
      primary.textContent = 'Refresh now';
      primary.setAttribute('data-job', 'hub-refresh');
      primary.setAttribute('data-route', '#dashboard/overview');
    }
  }

  var _activityLocal = [];
  var _activityTimer = null;

  function pushActivity(entry) {
    if (!entry) return;
    _activityLocal.unshift({
      id: 'local_' + Date.now(),
      status: entry.status || 'success',
      message: entry.message || 'Action',
      subsystem: entry.subsystem || 'hub',
      timestamp: new Date().toISOString()
    });
    _activityLocal = _activityLocal.slice(0, 8);
    renderActivityRail();
  }

  function activityStatusClass(status) {
    if (status === 'error' || status === 'fail' || status === 'red') return 'hub-act--err';
    if (status === 'warning' || status === 'yellow') return 'hub-act--warn';
    if (status === 'started' || status === 'running') return 'hub-act--run';
    return 'hub-act--ok';
  }

  function renderActivityRail(remoteEvents) {
    var list = document.getElementById('hub-activity-list');
    var rail = document.getElementById('hub-activity-rail');
    if (!list || !rail) return;

    var remote = Array.isArray(remoteEvents) ? remoteEvents : [];
    var merged = _activityLocal.concat(remote).slice(0, 12);
    rail.classList.remove('hidden');

    if (!merged.length) {
      list.innerHTML = '<li class="hub-act hub-act--ok"><span class="hub-act__meta">Quiet</span><span class="hub-act__msg">No recent ops activity</span></li>';
      return;
    }

    list.innerHTML = merged.map(function (ev) {
      var when = '';
      try { when = new Date(ev.timestamp || ev.at || Date.now()).toLocaleTimeString(); } catch (e) { when = ''; }
      var meta = document.createElement('div');
      meta.textContent = when + (ev.subsystem ? ' · ' + ev.subsystem : '');
      var msg = document.createElement('div');
      msg.textContent = ev.message || ev.title || ev.status || 'event';
      return '<li class="hub-act ' + activityStatusClass(ev.status) + '">'
        + '<span class="hub-act__meta">' + meta.innerHTML + '</span>'
        + '<span class="hub-act__msg">' + msg.innerHTML + '</span>'
        + '</li>';
    }).join('');
  }

  function refreshActivityRail() {
    apiGet('/api/ops/logs?limit=10')
      .then(function (j) {
        renderActivityRail((j && j.events) || []);
      })
      .catch(function () {
        renderActivityRail([]);
      });
  }

  function wireActivityRail() {
    var refreshBtn = document.getElementById('hub-activity-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshActivityRail);
    var jump = document.getElementById('hub-activity-ops');
    if (jump) {
      jump.addEventListener('click', function () {
        navigateFromHash('#dashboard/jobs');
      });
    }
    refreshActivityRail();
    if (_activityTimer) clearInterval(_activityTimer);
    _activityTimer = setInterval(refreshActivityRail, 60000);
  }

  function renderRoute() {
    var route = parseRoute();
    var section = findSection(route.section);
    var panelId = route.panel || (section.panels[0] && section.panels[0].id);

    document.querySelectorAll('.hub-nav-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-section') === section.id);
    });

    document.querySelectorAll('.hub-section').forEach(function (el) {
      el.classList.toggle('hidden', el.id !== ('hub-section-' + section.id));
    });

    document.querySelectorAll('.hub-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-section') === section.id && tab.getAttribute('data-panel') === panelId);
    });

    document.querySelectorAll('.hub-panel').forEach(function (panelEl) {
      var isActive = panelEl.getAttribute('data-section') === section.id && panelEl.getAttribute('data-panel') === panelId;
      panelEl.classList.toggle('hidden', !isActive);
      if (!isActive) return;

      if (panelEl.getAttribute('data-inline') === '1') {
        // Re-render on every visit so Command Center / Beat Desk / FC stay fresh.
        panelEl.setAttribute('data-rendered', '1');
        if (panelId === 'rerun' || panelId === 'runbooks') renderRunbooksPanel(panelEl);
        else if (panelId === 'vault-grades') renderVaultGradesPanel(panelEl);
        else if (panelId === 'board' && section.id === 'team' && global.GVAdminBoardSummary) {
          GVAdminBoardSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'board-full' && section.id === 'team' && global.GVAdminBoardFull) {
          GVAdminBoardFull.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'overview' && global.GVAdminDashboard) {
          GVAdminDashboard.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            pin: pin,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'ops-summary' && global.GVAdminOpsSummary) {
          GVAdminOpsSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'jobs' && global.GVAdminJobQueue) {
          GVAdminJobQueue.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash,
            pushActivity: pushActivity
          });
        }
        else if (panelId === 'desk' && section.id === 'beat-desk' && global.GVAdminBeatDesk) {
          GVAdminBeatDesk.render(panelEl, {
            apiGet: apiGet,
            apiBase: API,
            apiPost: apiPost,
            onNavigate: navigateFromHash,
            pushActivity: pushActivity
          });
        }
        else if (panelId === 'control' && section.id === 'futurecast' && global.GVAdminFutureCast) {
          GVAdminFutureCast.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash,
            pushActivity: pushActivity
          });
        }
        else if (panelId === 'post-studio' && global.GVAdminPostStudio) {
          GVAdminPostStudio.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash,
            pushActivity: pushActivity
          });
        }
        else if (panelId === 'summary' && section.id === 'qa' && global.GVAdminQaSummary) {
          GVAdminQaSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'daily' && section.id === 'recruiting' && global.GVAdminRecruitingSummary) {
          GVAdminRecruitingSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'unresolved' && section.id === 'recruiting' && global.GVAdminUnresolvedPredictions) {
          GVAdminUnresolvedPredictions.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash,
            pushActivity: pushActivity
          });
        }
        else if (panelId === 'alerts' && section.id === 'recruiting' && global.GVAdminAlertsSummary) {
          GVAdminAlertsSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'monitoring' && section.id === 'recruiting' && global.GVAdminMonitoringSummary) {
          GVAdminMonitoringSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if (panelId === 'summary' && section.id === 'product-intel' && global.GVAdminProductIntelSummary) {
          GVAdminProductIntelSummary.render(panelEl, {
            apiGet: apiGet,
            apiPost: apiPost,
            onNavigate: navigateFromHash
          });
        }
        else if ((panelId === 'recent' || panelId === 'members') && section.id === 'members') {
          if (global.GVAdminMembers) {
            GVAdminMembers.render(panelEl, {
              apiGet: apiGet,
              onNavigate: navigateFromHash
            });
          } else {
            panelEl.innerHTML = '<p class="hub-meta err">Members panel failed to load. Hard-refresh the page.</p>';
          }
        }
        else if (panelId === 'platform') renderSettingsPanel(panelEl);
        else if (panelId === 'control' && section.id === 'futurecast') {
          panelEl.innerHTML = '<p class="hub-meta err">FutureCast panel failed to load. Hard-refresh the page.</p>';
        }
        return;
      }

      var panel = section.panels.find(function (p) { return p.id === panelId; });
      if (panel && panel.embed) loadIframe(panelEl, panelSrc(panel));
    });

    var titleEl = document.getElementById('hub-page-title');
    if (titleEl) titleEl.textContent = section.label;
  }

  function unlockAdmin(p) {
    p = String(p || '').trim();
    sessionStorage.setItem(SESSION_KEY, p);
    sessionStorage.setItem(OPS_SESSION_KEY, p);
    var gate = document.getElementById('admin-pin-gate');
    if (gate) gate.classList.add('hidden');
    document.getElementById('hub-shell').classList.remove('hidden');
    initHub();
  }

  function lockAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(OPS_SESSION_KEY);
    if (_healthPollTimer) clearInterval(_healthPollTimer);
    if (_activityTimer) clearInterval(_activityTimer);
    _hubInitialized = false;
    location.replace('/admin/login');
  }

  function wireGate() {
    if (resolveLegacyPath()) return;

    var gateBtn = document.getElementById('gate-submit');
    var gateInput = document.getElementById('gate-pin');
    var gateErr = document.getElementById('gate-err');
    var useDedicatedLogin = location.pathname.indexOf('/admin/login') < 0;

    var lockBtn = document.getElementById('hub-lock');
    if (lockBtn) lockBtn.addEventListener('click', lockAdmin);

    var saved = sessionStorage.getItem(SESSION_KEY) || sessionStorage.getItem(OPS_SESSION_KEY);
    if (saved) {
      verifyPin(saved, function (ok) {
        if (ok) {
          unlockAdmin(saved);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(OPS_SESSION_KEY);
          if (useDedicatedLogin) redirectToLogin();
        }
      });
      return;
    }

    if (useDedicatedLogin) {
      redirectToLogin();
      return;
    }

    if (!gateBtn || !gateInput) return;

    gateBtn.addEventListener('click', function () {
      var p = gateInput.value.trim();
      if (!p) return;
      gateErr.classList.add('hidden');
      gateBtn.disabled = true;
      verifyPin(p, function (ok, errMsg) {
        gateBtn.disabled = false;
        if (ok) {
          unlockAdmin(p);
        } else {
          gateErr.textContent = errMsg || 'Invalid PIN. Use your OPS_ADMIN_PIN or RECRUITING_ADMIN_PIN value from Render.';
          gateErr.classList.remove('hidden');
        }
      });
    });
    gateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') gateBtn.click();
    });
  }

  global.GVAdminHub = {
    SECTIONS: SECTIONS,
    API: API,
    pin: pin,
    apiGet: apiGet,
    apiPost: apiPost,
    wireGate: wireGate,
    applyModuleHealth: applyModuleHealth,
    applyOpsStrip: applyOpsStrip,
    pushActivity: pushActivity
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGate);
  } else {
    wireGate();
  }
})(window);
