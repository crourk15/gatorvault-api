/**
 * GatorVault Unified Admin Hub — auth, routing, iframe panels.
 */
(function (global) {
  var SESSION_KEY = 'gv_admin_pin';
  var API = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : (location.origin.indexOf('gatorvault') >= 0 ? 'https://gatorvault-api.onrender.com' : location.origin);

  var EMBED_SRC = {
    ops: '/admin-ops.html?embed=1',
    qa: '/admin-qa.html?embed=1',
    feedback: '/admin-feedback.html?embed=1',
    monitoring: '/admin-monitoring.html?embed=1',
    'recruiting-alerts': '/recruiting-admin.html?embed=1',
    board: '/recruiting-board.html?embed=1',
    content: '/content-admin.html?embed=1',
    community: '/community-admin.html?embed=1',
    'war-room': '/war-room-admin.html?embed=1',
    gm2: '/admin-ops-gm2.html?embed=1',
    identity: '/admin-ops-identity-patterns.html?embed=1'
  };

  var LEGACY_PATHS = {
    '/admin/qa': { section: 'qa', panel: 'monitor' },
    '/admin-qa.html': { section: 'qa', panel: 'monitor' },
    '/admin/ops': { section: 'dashboard', panel: 'ops' },
    '/admin/feedback': { section: 'feedback', panel: 'inbox' },
    '/admin/monitoring': { section: 'recruiting', panel: 'monitoring' },
    '/admin/ops/gm2': { section: 'gm2', panel: 'integrity' },
    '/admin/ops/identity-patterns': { section: 'gm2', panel: 'identity' },
    '/vault/ops': { section: 'dashboard', panel: 'ops' },
    '/recruiting-admin.html': { section: 'recruiting', panel: 'alerts' },
    '/recruiting-board.html': { section: 'team', panel: 'board' },
    '/content-admin.html': { section: 'content', panel: 'content-accuracy' },
    '/community-admin.html': { section: 'community', panel: 'moderation' },
    '/war-room-admin.html': { section: 'team', panel: 'war-room' }
  };

  var SECTIONS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      desc: 'System health, autoposter, GM2 alerts, repair queue',
      panels: [
        { id: 'ops', label: 'Operations', embed: 'ops' }
      ]
    },
    {
      id: 'qa',
      label: 'QA Monitor',
      icon: '🛡️',
      desc: '24/7 crawler — pages, API, content, UX integrity',
      panels: [{ id: 'monitor', label: 'QA Dashboard', embed: 'qa' }]
    },
    {
      id: 'recruiting',
      label: 'Recruiting Admin',
      icon: '🎯',
      desc: 'Players, vault grades, targets, visits, commitments, intel',
      panels: [
        { id: 'alerts', label: 'Alerts & Live', embed: 'recruiting-alerts' },
        { id: 'monitoring', label: 'Monitoring', embed: 'monitoring' }
      ]
    },
    {
      id: 'team',
      label: 'Team Admin',
      icon: '🐊',
      desc: 'Depth chart, roster, coaching staff, team history, film room',
      panels: [
        { id: 'board', label: 'Roster & Board', embed: 'board' },
        { id: 'war-room', label: 'War Room Breakdowns', embed: 'war-room' }
      ]
    },
    {
      id: 'content',
      label: 'Content & Media',
      icon: '📺',
      desc: 'Film room, legacy videos, pressers, podcasts, headlines',
      panels: [
        { id: 'content-accuracy', label: 'Content Accuracy', embed: 'content' },
        { id: 'insider-articles', label: 'Insider Articles', embed: 'ops', hash: '#insider-articles' }
      ]
    },
    {
      id: 'community',
      label: 'Community Admin',
      icon: '💬',
      desc: 'Threads, flags, reports, categories',
      panels: [{ id: 'moderation', label: 'Moderation Queue', embed: 'community' }]
    },
    {
      id: 'feedback',
      label: 'Feedback & Support',
      icon: '📬',
      desc: 'Feedback inbox, bug reports, feature requests',
      panels: [{ id: 'inbox', label: 'Feedback Inbox', embed: 'feedback' }]
    },
    {
      id: 'gm2',
      label: 'GM2 Control Center',
      icon: '🛡️',
      desc: 'Rules engine, identity resolution, ingest logs, autoposter',
      panels: [
        { id: 'integrity', label: 'GM2 Integrity', embed: 'gm2' },
        { id: 'identity', label: 'Identity Patterns', embed: 'identity' }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      desc: 'Branding, theme, permissions, API keys',
      panels: [{ id: 'platform', label: 'Platform Settings', inline: true }]
    }
  ];

  function pin() {
    return sessionStorage.getItem(SESSION_KEY) || '';
  }

  function parseApiResponse(r) {
    return r.text().then(function (text) {
      var j = null;
      try { j = text ? JSON.parse(text) : {}; } catch (e) {
        throw new Error(text ? text.slice(0, 200) : ('HTTP ' + r.status));
      }
      if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
      return j;
    });
  }

  function apiPost(path, body) {
    var p = pin();
    if (!p) return Promise.reject(new Error('Admin PIN required'));
    return fetch(API + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Recruiting-Pin': p,
        'X-Ops-Pin': p
      },
      body: JSON.stringify(Object.assign({ pin: p }, body || {}))
    }).then(parseApiResponse);
  }

  function apiGet(path) {
    var p = pin();
    if (!p) return Promise.reject(new Error('Admin PIN required'));
    return fetch(API + path, {
      headers: { 'X-Recruiting-Pin': p, 'X-Ops-Pin': p }
    }).then(parseApiResponse);
  }

  function verifyPin(p, cb) {
    fetch(API + '/api/ops/status?pin=' + encodeURIComponent(p), {
      headers: { 'X-Ops-Pin': p, 'X-Recruiting-Pin': p }
    })
      .then(function (r) { cb(r.ok); })
      .catch(function () { cb(false); });
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
      location.replace('/admin#' + leg.section + (leg.panel ? '/' + leg.panel : ''));
      return true;
    }
    return false;
  }

  function findSection(id) {
    return SECTIONS.find(function (s) { return s.id === id; }) || SECTIONS[0];
  }

  function parseRoute() {
    var hash = (location.hash || '#dashboard').replace(/^#/, '');
    if (hash === 'qa' || hash === 'dashboard/qa') {
      return { section: 'qa', panel: 'monitor' };
    }
    var parts = hash.split('/');
    return { section: parts[0] || 'dashboard', panel: parts[1] || null };
  }

  function setRoute(sectionId, panelId) {
    var hash = panelId ? ('#' + sectionId + '/' + panelId) : ('#' + sectionId);
    if (location.hash !== hash) location.hash = hash;
  }

  function postPinToIframe(iframe) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'gv-admin-pin', pin: pin() }, '*');
  }

  function loadIframe(panelEl, src) {
    var iframe = panelEl.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'hub-iframe';
      iframe.title = 'Admin panel';
      iframe.setAttribute('loading', 'lazy');
      panelEl.appendChild(iframe);
    }
    var fullSrc = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'pin=' + encodeURIComponent(pin());
    if (iframe.getAttribute('data-src') !== fullSrc) {
      iframe.setAttribute('data-src', fullSrc);
      iframe.src = fullSrc;
    }
    iframe.onload = function () { postPinToIframe(iframe); };
    postPinToIframe(iframe);
  }

  function renderSettingsPanel(container) {
    container.innerHTML = ''
      + '<div class="hub-settings-grid">'
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
      + '<div class="hub-card"><h3>Permissions &amp; API Keys</h3>'
      + '<p class="hub-meta">PIN env vars: <code>OPS_ADMIN_PIN</code>, <code>RECRUITING_ADMIN_PIN</code>, <code>CONTENT_ADMIN_PIN</code>, <code>COMMUNITY_ADMIN_PIN</code>, <code>LIVE_ADMIN_PIN</code></p>'
      + '<p class="hub-meta">Branding and theme controls ship in a future settings release. Use Render env + <code>official-names.json</code> for coach identity today.</p>'
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
      apiGet('/api/points/admin/lookup?email=' + encodeURIComponent(email) + '&pin=' + encodeURIComponent(pin()))
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
    var navEl = document.getElementById('hub-nav');
    var mainEl = document.getElementById('hub-main');
    if (!navEl || !mainEl) return;

    SECTIONS.forEach(function (sec) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hub-nav-btn';
      btn.setAttribute('data-section', sec.id);
      btn.innerHTML = '<span class="hub-nav-icon">' + sec.icon + '</span><span class="hub-nav-label">' + sec.label + '</span>';
      btn.addEventListener('click', function () { setRoute(sec.id, sec.panels[0] && sec.panels[0].id); renderRoute(); });
      navEl.appendChild(btn);

      var sectionEl = document.createElement('section');
      sectionEl.className = 'hub-section hidden';
      sectionEl.id = 'hub-section-' + sec.id;
      sectionEl.innerHTML = '<div class="hub-section-head"><h2>' + sec.icon + ' ' + sec.label + '</h2><p>' + sec.desc + '</p></div>';

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

    renderRoute();
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
        if (!panelEl.getAttribute('data-rendered')) {
          panelEl.setAttribute('data-rendered', '1');
          renderSettingsPanel(panelEl);
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
    sessionStorage.setItem(SESSION_KEY, p);
    document.getElementById('admin-pin-gate').classList.add('hidden');
    document.getElementById('hub-shell').classList.remove('hidden');
    initHub();
  }

  function lockAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function wireGate() {
    if (resolveLegacyPath()) return;

    var gateBtn = document.getElementById('gate-submit');
    var gateInput = document.getElementById('gate-pin');
    var gateErr = document.getElementById('gate-err');
    if (!gateBtn || !gateInput) return;

    gateBtn.addEventListener('click', function () {
      var p = gateInput.value.trim();
      if (!p) return;
      gateErr.classList.add('hidden');
      verifyPin(p, function (ok) {
        if (ok) unlockAdmin(p);
        else gateErr.classList.remove('hidden');
      });
    });
    gateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') gateBtn.click();
    });

    var lockBtn = document.getElementById('hub-lock');
    if (lockBtn) lockBtn.addEventListener('click', lockAdmin);

    var saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      verifyPin(saved, function (ok) {
        if (ok) unlockAdmin(saved);
      });
    }
  }

  global.GVAdminHub = {
    SECTIONS: SECTIONS,
    API: API,
    pin: pin,
    apiGet: apiGet,
    apiPost: apiPost,
    wireGate: wireGate
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGate);
  } else {
    wireGate();
  }
})(window);
