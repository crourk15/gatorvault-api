/**
 * GatorVault Unified Admin Hub — auth, routing, iframe panels.
 */
(function (global) {
  var SESSION_KEY = 'gv_admin_pin';
  var OPS_SESSION_KEY = 'gv_ops_pin';

  function resolveAdminApiBase() {
    var host = (location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    if (host === 'gatorvault-api.onrender.com') return location.origin;
    if (host.indexOf('gatorvault') >= 0 || host.indexOf('gatorvaultinsider') >= 0 || host.endsWith('.netlify.app')) {
      return 'https://gatorvault-api.onrender.com';
    }
    return location.origin;
  }

  var API = resolveAdminApiBase();
  var _hubInitialized = false;

  var EMBED_SRC = {
    ops: '/admin-ops.html?embed=1',
    qa: '/admin-qa.html?embed=1',
    'qa-mobile': '/admin-qa-mobile.html?embed=1',
    'product-intel': '/admin-product-intel.html?embed=1',
    'self-runner': '/admin-self-runner.html?embed=1',
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
    '/admin/qa/mobile-behavior': { section: 'qa', panel: 'mobile-behavior' },
    '/admin-qa-mobile.html': { section: 'qa', panel: 'mobile-behavior' },
    '/admin/product-health': { section: 'product-intel', panel: 'health' },
    '/admin-product-intel.html': { section: 'product-intel', panel: 'health' },
    '/admin/self-runner': { section: 'self-runner', panel: 'pending' },
    '/admin-self-runner.html': { section: 'self-runner', panel: 'pending' },
    '/admin/ops': { section: 'dashboard', panel: 'ops' },
    '/admin/feedback': { section: 'feedback', panel: 'inbox' },
    '/admin/monitoring': { section: 'recruiting', panel: 'monitoring' },
    '/admin/ops/gm2': { section: 'gm2', panel: 'rerun' },
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
      desc: 'System health, autoposter, GM alerts, repair queue',
      panels: [
        { id: 'ops', label: 'Operations', embed: 'ops' }
      ]
    },
    {
      id: 'gm2',
      label: 'GM',
      icon: '🛡️',
      desc: 'Re-run modules, rules engine, identity resolution, ingest integrity',
      panels: [
        { id: 'rerun', label: 'Re-run Modules', inline: true },
        { id: 'integrity', label: 'GM Integrity', embed: 'gm2' },
        { id: 'identity', label: 'Identity Patterns', embed: 'identity' }
      ]
    },
    {
      id: 'product-intel',
      label: 'Product Health',
      icon: '🧠',
      desc: 'Platform intelligence — scores, fix queue, daily & weekly reports',
      panels: [{ id: 'health', label: 'Product Intelligence', embed: 'product-intel' }]
    },
    {
      id: 'self-runner',
      label: 'Self-Runner',
      icon: '🤖',
      desc: 'Auto-fix proposals — approve before apply, deploy, and QA validation',
      panels: [{ id: 'pending', label: 'Pending Fixes', embed: 'self-runner' }]
    },
    {
      id: 'qa',
      label: 'QA Monitor',
      icon: '🛡️',
      desc: '24/7 crawler — pages, API, content, UX integrity',
      panels: [
        { id: 'monitor', label: 'QA Dashboard', embed: 'qa' },
        { id: 'mobile-behavior', label: 'Mobile Behavior', embed: 'qa-mobile' }
      ]
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
        { id: 'vault-grades', label: 'Vault Grades', inline: true },
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
        'X-Ops-Pin': p,
        'X-Roster-Pin': p
      },
      body: JSON.stringify(Object.assign({ pin: p }, body || {}))
    }).then(parseApiResponse);
  }

  function apiGet(path) {
    var p = pin();
    if (!p) return Promise.reject(new Error('Admin PIN required'));
    return fetch(API + path, {
      headers: { 'X-Recruiting-Pin': p, 'X-Ops-Pin': p, 'X-Roster-Pin': p }
    }).then(parseApiResponse);
  }

  function adminPinHeaders(p) {
    return { 'X-Ops-Pin': p, 'X-Recruiting-Pin': p };
  }

  function verifyPinViaStatus(p) {
    return fetch(API + '/api/ops/status?pin=' + encodeURIComponent(p), {
      method: 'GET',
      headers: adminPinHeaders(p),
      credentials: 'omit'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
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
    fetch(API + '/api/ops/verify-pin?pin=' + encodeURIComponent(p), {
      method: 'GET',
      headers: adminPinHeaders(p),
      credentials: 'omit'
    })
      .then(function (r) {
        if (r.status === 404) return verifyPinViaStatus(p);
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j && j.ok) return true;
          if (r.status === 401) return false;
          return verifyPinViaStatus(p);
        });
      })
      .catch(function () { return verifyPinViaStatus(p); })
      .then(function (ok) { cb(!!ok); })
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
    if (hash === 'product-health' || hash === 'dashboard/product-health') {
      return { section: 'product-intel', panel: 'health' };
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

  function renderVaultGradesPanel(container) {
    container.innerHTML = ''
      + '<div class="hub-settings-grid">'
      + '<div class="hub-card hub-card-wide"><h3>Vault Grade Editor</h3>'
      + '<p class="hub-meta">Override Vault Grades for roster players. Changes apply instantly across Top Gators, Roster, and War Room.</p>'
      + '<label>Search player</label>'
      + '<input id="hub-vg-search" type="search" placeholder="Name or slug">'
      + '<div id="hub-vg-list" class="hub-log" style="max-height:280px;margin-top:8px"></div>'
      + '</div>'
      + '<div class="hub-card hub-card-wide"><h3>Edit Grade</h3>'
      + '<p id="hub-vg-player-label" class="hub-meta">Select a player from the list</p>'
      + '<input type="hidden" id="hub-vg-slug">'
      + '<label>Vault Grade (0–99)</label>'
      + '<input id="hub-vg-grade" type="number" min="0" max="99" step="0.1" placeholder="88.5">'
      + '<label>Grade Explanation</label>'
      + '<textarea id="hub-vg-explanation" rows="4" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #334155;background:#111827;color:#f8fafc;font:inherit" placeholder="Why this grade…"></textarea>'
      + '<label>Timestamp</label>'
      + '<input id="hub-vg-ts" type="datetime-local">'
      + '<div class="hub-btn-row" style="margin-top:10px">'
      + '<button type="button" class="hub-btn" id="hub-vg-save">Save Vault Grade</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-vg-clear">Clear Override</button>'
      + '</div>'
      + '<p id="hub-vg-status" class="hub-meta"></p>'
      + '</div>'
      + '</div>';

    var rosterCache = [];

    function vgLog(msg, cls) {
      var el = document.getElementById('hub-vg-status');
      if (el) { el.textContent = msg; el.className = 'hub-meta ' + (cls || ''); }
    }

    function renderVgList(q) {
      var listEl = document.getElementById('hub-vg-list');
      if (!listEl) return;
      var query = String(q || '').toLowerCase().trim();
      var rows = rosterCache.filter(function (p) {
        if (!query) return true;
        return String(p.name || '').toLowerCase().indexOf(query) >= 0 || String(p.slug || '').toLowerCase().indexOf(query) >= 0;
      }).slice(0, 80);
      if (!rows.length) {
        listEl.innerHTML = '<div class="info">No players found.</div>';
        return;
      }
      listEl.innerHTML = rows.map(function (p) {
        var grade = p.ratingOverride != null ? p.ratingOverride : (p.displayRating != null ? p.displayRating : p.rating);
        return '<button type="button" data-vg-slug="' + p.slug + '" style="display:block;width:100%;text-align:left;background:transparent;border:none;color:#cbd5e1;padding:6px 4px;cursor:pointer;font:inherit">'
          + (p.name || p.slug) + ' · ' + (grade != null ? grade : '—') + (p.vaultGradeExplanation ? ' · ✎' : '')
          + '</button>';
      }).join('');
      listEl.querySelectorAll('[data-vg-slug]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-vg-slug');
          var p = rosterCache.find(function (x) { return x.slug === slug; });
          if (!p) return;
          document.getElementById('hub-vg-slug').value = slug;
          document.getElementById('hub-vg-player-label').textContent = (p.name || slug) + ' (' + slug + ')';
          document.getElementById('hub-vg-grade').value = p.ratingOverride != null ? p.ratingOverride : (p.displayRating != null ? p.displayRating : '');
          document.getElementById('hub-vg-explanation').value = p.vaultGradeExplanation || '';
          var ts = p.vaultGradeUpdatedAt ? new Date(p.vaultGradeUpdatedAt) : new Date();
          document.getElementById('hub-vg-ts').value = ts.toISOString().slice(0, 16);
        });
      });
    }

    function loadRoster() {
      apiGet('/api/roster/players')
        .then(function (j) {
          rosterCache = (j.players || []).sort(function (a, b) {
            return (b.displayRating || 0) - (a.displayRating || 0);
          });
          renderVgList(document.getElementById('hub-vg-search').value);
        })
        .catch(function (e) { vgLog(e.message, 'err'); });
    }

    document.getElementById('hub-vg-search').addEventListener('input', function (e) {
      renderVgList(e.target.value);
    });

    document.getElementById('hub-vg-save').addEventListener('click', function () {
      var slug = document.getElementById('hub-vg-slug').value.trim();
      if (!slug) return vgLog('Select a player first', 'err');
      var grade = document.getElementById('hub-vg-grade').value;
      var explanation = document.getElementById('hub-vg-explanation').value.trim();
      var tsLocal = document.getElementById('hub-vg-ts').value;
      var ts = tsLocal ? new Date(tsLocal).toISOString() : new Date().toISOString();
      apiPost('/api/roster/players/' + encodeURIComponent(slug) + '/vault-grade', {
        grade: grade,
        gradeExplanation: explanation,
        timestamp: ts
      }).then(function (j) {
        var idx = rosterCache.findIndex(function (x) { return x.slug === slug; });
        if (idx >= 0) rosterCache[idx] = j.player;
        try { localStorage.setItem('gv_roster_updated', String(Date.now())); } catch (e) {}
        vgLog('Saved — grade live on site', 'ok');
        renderVgList(document.getElementById('hub-vg-search').value);
      }).catch(function (e) { vgLog(e.message, 'err'); });
    });

    document.getElementById('hub-vg-clear').addEventListener('click', function () {
      var slug = document.getElementById('hub-vg-slug').value.trim();
      if (!slug) return vgLog('Select a player first', 'err');
      apiPost('/api/roster/players/' + encodeURIComponent(slug) + '/vault-grade', {
        clear: true,
        grade: null,
        gradeExplanation: '',
        timestamp: new Date().toISOString()
      }).then(function (j) {
        var idx = rosterCache.findIndex(function (x) { return x.slug === slug; });
        if (idx >= 0) rosterCache[idx] = j.player;
        try { localStorage.setItem('gv_roster_updated', String(Date.now())); } catch (e) {}
        document.getElementById('hub-vg-grade').value = '';
        document.getElementById('hub-vg-explanation').value = '';
        vgLog('Override cleared', 'ok');
        renderVgList(document.getElementById('hub-vg-search').value);
      }).catch(function (e) { vgLog(e.message, 'err'); });
    });

    loadRoster();
  }

  function renderGmRerunPanel(container) {
    container.innerHTML = ''
      + '<div class="hub-settings-grid">'
      + '<div class="hub-card hub-card-wide"><h3>GM — Re-run Modules</h3>'
      + '<p class="hub-meta">Trigger rebuilds and QA without leaving Admin Hub. Requires valid admin PIN.</p>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn" data-gm-action="force-autoposter">Force Autoposter</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="live-refresh">Re-run Latest Updates</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="team-rebuild">Re-run Team Tab</button>'
      + '<button type="button" class="hub-btn" data-gm-action="qa-run">Run QA Crawl</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="film-rebuild">Rebuild Film Room</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="scouting-rebuild">Rebuild Scouting DB</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="heat-refresh">Refresh Heat Check</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="gm2-repair">GM Auto-Repair</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="mobile-latest-refresh">Force Mobile Auto-Refresh Now</button>'
      + '<button type="button" class="hub-btn secondary" data-gm-action="purge-beat">Purge Non-UF Beat</button>'
      + '</div></div>'
      + '<div class="hub-card hub-card-wide"><h3>GM Log</h3><div id="hub-gm-log" class="hub-log"></div></div>'
      + '</div>';

    function gmLog(msg, cls) {
      var el = document.getElementById('hub-gm-log');
      if (!el) return;
      var line = document.createElement('div');
      line.className = cls || 'info';
      line.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
      el.prepend(line);
    }

    container.querySelectorAll('[data-gm-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-gm-action');
        btn.disabled = true;
        var p;
        if (action === 'force-autoposter') p = apiPost('/api/autoposter/force-post', {});
        else if (action === 'live-refresh') p = apiPost('/api/live/refresh', {});
        else if (action === 'team-rebuild') p = apiPost('/api/ops/run-job', { jobId: 'depth-chart-refresh' });
        else if (action === 'qa-run') p = apiPost('/api/qa/run', { scope: 'full' });
        else if (action === 'film-rebuild') p = apiPost('/api/film-room/admin/rebuild', { scope: 'all' });
        else if (action === 'scouting-rebuild') p = apiPost('/api/war-room/admin/rebuild-scouting', {});
        else if (action === 'heat-refresh') p = apiGet('/api/recruiting/heat-check?force=1&pin=' + encodeURIComponent(pin()));
        else if (action === 'gm2-repair') p = apiPost('/api/gm2/auto-repair/run', {});
        else if (action === 'mobile-latest-refresh') {
          p = apiPost('/api/live/refresh', {}).then(function () {
            return apiPost('/api/live/admin/mobile-refresh-signal', {});
          });
        }
        else if (action === 'purge-beat') p = apiPost('/api/live/admin/purge-non-uf-beat', {});
        else p = Promise.resolve();
        p.then(function (j) { gmLog('Done: ' + JSON.stringify(j).slice(0, 200), 'ok'); })
          .catch(function (e) { gmLog(e.message, 'err'); })
          .finally(function () { btn.disabled = false; });
      });
    });
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
    if (_hubInitialized) {
      renderRoute();
      return;
    }
    _hubInitialized = true;
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
          if (panelId === 'rerun') renderGmRerunPanel(panelEl);
          else if (panelId === 'vault-grades') renderVaultGradesPanel(panelEl);
          else renderSettingsPanel(panelEl);
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
    document.getElementById('admin-pin-gate').classList.add('hidden');
    document.getElementById('hub-shell').classList.remove('hidden');
    initHub();
  }

  function lockAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(OPS_SESSION_KEY);
    _hubInitialized = false;
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
      gateBtn.disabled = true;
      verifyPin(p, function (ok) {
        gateBtn.disabled = false;
        if (ok) {
          unlockAdmin(p);
        } else {
          gateErr.textContent = 'Invalid PIN. Use your OPS_ADMIN_PIN or RECRUITING_ADMIN_PIN value from Render.';
          gateErr.classList.remove('hidden');
        }
      });
    });
    gateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') gateBtn.click();
    });

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
        }
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
