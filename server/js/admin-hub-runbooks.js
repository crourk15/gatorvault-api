/**
 * Admin Hub Runbooks — preset ops flows with Charles-friendly status.
 */
(function (global) {
  var JOB_LOG_KEY = 'gv_admin_runbook_jobs';
  var MAX_LOG = 40;

  var RUNBOOKS = [
    {
      id: 'deploy-recovery',
      title: 'Deploy recovery',
      desc: 'Nudge the live feed cache after the server wakes up. If it fails with “still starting”, wait 2 minutes and Run again.',
      steps: [
        { id: 'live-refresh', label: 'Refresh live hub', kind: 'post', path: '/api/live/refresh', body: {} },
        { id: 'mobile-signal', label: 'Tell phones to refresh', kind: 'post', path: '/api/live/admin/mobile-refresh-signal', body: {} }
      ]
    },
    {
      id: 'qa-red',
      title: 'QA is red',
      desc: 'Run a full website check, then open the QA monitor.',
      steps: [
        { id: 'qa-run', label: 'Run QA crawl', kind: 'post', path: '/api/qa/run', body: { scope: 'full' } }
      ],
      afterRoute: '#qa/monitor'
    },
    {
      id: 'ingest-lag',
      title: 'Ingest lag',
      desc: 'When recruiting boards look stale: force a heat check, then refresh the live hub.',
      steps: [
        { id: 'heat', label: 'Force heat check', kind: 'get', path: '/api/recruiting/heat-check?force=1' },
        { id: 'live-refresh', label: 'Refresh live hub', kind: 'post', path: '/api/live/refresh', body: {} }
      ]
    },
    {
      id: 'content-rebuild',
      title: 'Content rebuild',
      desc: 'Rebuild Film Room + Scouting when those pages look stuck.',
      steps: [
        { id: 'film', label: 'Rebuild Film Room', kind: 'post', path: '/api/film-room/admin/rebuild', body: { scope: 'all' } },
        { id: 'scouting', label: 'Rebuild Scouting DB', kind: 'post', path: '/api/war-room/admin/rebuild-scouting', body: {} }
      ]
    },
    {
      id: 'live-quiet',
      title: 'Live feed quiet',
      desc: 'Clear non-UF beat noise, then refresh the live hub.',
      steps: [
        { id: 'purge', label: 'Purge non-UF beat', kind: 'post', path: '/api/live/admin/purge-non-uf-beat', body: {} },
        { id: 'live-refresh', label: 'Refresh live hub', kind: 'post', path: '/api/live/refresh', body: {} }
      ]
    }
  ];

  function readLog() {
    try {
      var raw = sessionStorage.getItem(JOB_LOG_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeLog(list) {
    try {
      sessionStorage.setItem(JOB_LOG_KEY, JSON.stringify(list.slice(0, MAX_LOG)));
    } catch (e) { /* ignore quota */ }
  }

  function pushJob(entry) {
    var list = readLog();
    list.unshift(entry);
    writeLog(list);
    return list;
  }

  function updateJob(id, patch) {
    var list = readLog().map(function (row) {
      return row.id === id ? Object.assign({}, row, patch) : row;
    });
    writeLog(list);
    return list;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusClass(st) {
    if (st === 'ok') return 'ok';
    if (st === 'fail') return 'err';
    if (st === 'running') return 'info';
    return 'info';
  }

  function charlesFailMessage(err, stepLabel) {
    var msg = String((err && err.message) || '');
    var wake = !!(err && err.wake) || /waking kitchen|kitchen starting|connecting to kitchen|warming|502|503|504|Failed to fetch|NetworkError|Load failed/i.test(msg);
    if (wake) {
      return 'Server still starting'
        + (stepLabel ? ' during “' + stepLabel + '”' : '')
        + '. Wait 2 minutes, then press Run again. Normal after sleep — not a broken deploy.';
    }
    if (/Invalid PIN|401/i.test(msg)) {
      return 'PIN rejected. Lock the hub and log in again with the ops PIN.';
    }
    return (stepLabel ? stepLabel + ' failed: ' : '') + (msg || 'Unknown error');
  }

  function isWakeMode() {
    try {
      if (sessionStorage.getItem('gv:hub:wakeMode') === '1') return true;
    } catch (e) { /* ignore */ }
    var banner = document.getElementById('hub-api-banner');
    if (banner && !banner.classList.contains('hidden')) {
      // Critical API-down flash is NOT wake — Deploy recovery must stay available.
      if (banner.classList.contains('hub-api-banner--critical')) return false;
      var t = String(banner.textContent || '');
      if (/API DOWN/i.test(t)) return false;
      if (/waking|sit tight|still starting/i.test(t)) return true;
    }
    var recent = readLog().slice(0, 3);
    return recent.some(function (row) {
      return row.status === 'fail' && /still starting|waking kitchen/i.test(String(row.detail || ''));
    });
  }

  function renderLog(el) {
    if (!el) return;
    var list = readLog();
    if (!list.length) {
      el.innerHTML = '<div class="hub-meta">No runbook jobs yet. Run a preset above.</div>';
      return;
    }
    el.innerHTML = list.map(function (row) {
      var when = row.at ? new Date(row.at).toLocaleTimeString() : '';
      return '<div class="' + statusClass(row.status) + '">'
        + '<strong>[' + esc(row.status) + ']</strong> '
        + esc(when) + ' — ' + esc(row.title)
        + (row.detail ? ' · ' + esc(row.detail) : '')
        + '</div>';
    }).join('');
  }

  function runStep(api, step) {
    var opts = { retries: 8, retryDelayMs: 2500 };
    if (step.kind === 'get') {
      return typeof api.apiGet === 'function' && api.apiGet.length > 1
        ? api.apiGet(step.path, opts)
        : api.apiGet(step.path);
    }
    return typeof api.apiPost === 'function' && api.apiPost.length > 2
      ? api.apiPost(step.path, step.body || {}, opts)
      : api.apiPost(step.path, step.body || {});
  }

  function runBook(api, book, ui) {
    var jobId = book.id + '-' + Date.now();
    var currentStep = null;
    pushJob({
      id: jobId,
      title: book.title,
      status: 'running',
      detail: 'Starting…',
      at: new Date().toISOString()
    });
    renderLog(ui.logEl);
    ui.setBusy(true);

    var chain = Promise.resolve();
    book.steps.forEach(function (step, idx) {
      chain = chain.then(function () {
        currentStep = step;
        updateJob(jobId, {
          status: 'running',
          detail: 'Step ' + (idx + 1) + '/' + book.steps.length + ': ' + step.label + ' (waiting on server if needed)…'
        });
        renderLog(ui.logEl);
        return runStep(api, step);
      });
    });

    return chain
      .then(function () {
        updateJob(jobId, {
          status: 'ok',
          detail: 'All steps finished. Go back to Command Center and press Refresh.',
          at: new Date().toISOString()
        });
        renderLog(ui.logEl);
        if (book.afterRoute && typeof api.onNavigate === 'function') {
          api.onNavigate(book.afterRoute);
        }
      })
      .catch(function (err) {
        updateJob(jobId, {
          status: 'fail',
          detail: charlesFailMessage(err, currentStep && currentStep.label),
          at: new Date().toISOString()
        });
        renderLog(ui.logEl);
      })
      .finally(function () {
        ui.setBusy(false);
      });
  }

  function render(container, api) {
    container.innerHTML = ''
      + '<div class="hub-section-head">'
      + '<h2>Runbooks</h2>'
      + '<p>One-click fix recipes. While the server is waking, Deploy recovery stays locked — use Command Center → Make it green instead.</p>'
      + '</div>'
      + '<div class="hub-settings-grid" id="hub-runbook-grid"></div>'
      + '<div class="hub-card hub-card-wide" style="margin-top:16px">'
      + '<h3>Job status</h3>'
      + '<div id="hub-runbook-log" class="hub-log"></div>'
      + '</div>';

    var grid = container.querySelector('#hub-runbook-grid');
    var logEl = container.querySelector('#hub-runbook-log');
    var busy = false;

    var wake = isWakeMode();
    RUNBOOKS.forEach(function (book) {
      var card = document.createElement('div');
      card.className = 'hub-card';
      var blocked = wake && (book.id === 'deploy-recovery' || book.id === 'ingest-lag' || book.id === 'live-quiet');
      card.innerHTML = ''
        + '<h3>' + esc(book.title) + '</h3>'
        + '<p class="hub-meta">' + esc(book.desc) + '</p>'
        + '<p class="hub-meta">' + book.steps.length + ' step' + (book.steps.length === 1 ? '' : 's') + '</p>'
        + (blocked
          ? '<p class="hub-meta" style="color:#fde047">Wait — server still waking. Do not run this yet.</p>'
            + '<button type="button" class="hub-btn secondary" disabled>Wait…</button>'
          : '<button type="button" class="hub-btn" data-runbook="' + esc(book.id) + '">Run</button>');
      grid.appendChild(card);
    });
    if (wake) {
      var tip = document.createElement('div');
      tip.className = 'hub-card hub-card-wide';
      tip.innerHTML = '<p class="hub-meta" style="color:#fde047;margin:0">Server is waking. Go to <strong>Command Center</strong>, sit tight / press <strong>Make it green</strong>. Do not spam Deploy recovery.</p>';
      grid.insertBefore(tip, grid.firstChild);
    }

    var ui = {
      logEl: logEl,
      setBusy: function (v) {
        busy = !!v;
        container.querySelectorAll('[data-runbook]').forEach(function (btn) {
          btn.disabled = busy;
        });
      }
    };

    renderLog(logEl);

    container.querySelectorAll('[data-runbook]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var id = btn.getAttribute('data-runbook');
        var book = RUNBOOKS.find(function (b) { return b.id === id; });
        if (!book) return;
        runBook(api, book, ui);
      });
    });
  }

  global.GVAdminRunbooks = {
    render: render,
    RUNBOOKS: RUNBOOKS,
    charlesFailMessage: charlesFailMessage
  };
})(window);
