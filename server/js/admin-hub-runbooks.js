/**
 * Admin Hub Runbooks — preset ops flows with job status (in-shell, no iframe).
 */
(function (global) {
  var JOB_LOG_KEY = 'gv_admin_runbook_jobs';
  var MAX_LOG = 40;

  var RUNBOOKS = [
    {
      id: 'deploy-recovery',
      title: 'Deploy recovery',
      desc: 'Refresh live hub cache, then signal mobile clients to pull fresh data.',
      steps: [
        { id: 'live-refresh', label: 'Refresh live hub', kind: 'post', path: '/api/live/refresh', body: {} },
        { id: 'mobile-signal', label: 'Mobile refresh signal', kind: 'post', path: '/api/live/admin/mobile-refresh-signal', body: {} }
      ]
    },
    {
      id: 'qa-red',
      title: 'QA is red',
      desc: 'Run a full QA crawl and open the QA monitor when finished.',
      steps: [
        { id: 'qa-run', label: 'Run QA crawl', kind: 'post', path: '/api/qa/run', body: { scope: 'full' } }
      ],
      afterRoute: '#qa/monitor'
    },
    {
      id: 'ingest-lag',
      title: 'Ingest lag',
      desc: 'Force recruiting heat refresh and live hub rebuild when boards look stale.',
      steps: [
        { id: 'heat', label: 'Force heat check', kind: 'get', path: '/api/recruiting/heat-check?force=1' },
        { id: 'live-refresh', label: 'Refresh live hub', kind: 'post', path: '/api/live/refresh', body: {} }
      ]
    },
    {
      id: 'content-rebuild',
      title: 'Content rebuild',
      desc: 'Rebuild Film Room and Scouting DB after content pipeline stalls.',
      steps: [
        { id: 'film', label: 'Rebuild Film Room', kind: 'post', path: '/api/film-room/admin/rebuild', body: { scope: 'all' } },
        { id: 'scouting', label: 'Rebuild Scouting DB', kind: 'post', path: '/api/war-room/admin/rebuild-scouting', body: {} }
      ]
    },
    {
      id: 'live-quiet',
      title: 'Live feed quiet',
      desc: 'Purge non-UF beat noise, then refresh the live hub.',
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
    if (step.kind === 'get') return api.apiGet(step.path);
    return api.apiPost(step.path, step.body || {});
  }

  function runBook(api, book, ui) {
    var jobId = book.id + '-' + Date.now();
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
        updateJob(jobId, {
          status: 'running',
          detail: 'Step ' + (idx + 1) + '/' + book.steps.length + ': ' + step.label
        });
        renderLog(ui.logEl);
        return runStep(api, step);
      });
    });

    return chain
      .then(function () {
        updateJob(jobId, { status: 'ok', detail: 'All steps finished', at: new Date().toISOString() });
        renderLog(ui.logEl);
        if (book.afterRoute && typeof api.onNavigate === 'function') {
          api.onNavigate(book.afterRoute);
        }
      })
      .catch(function (err) {
        updateJob(jobId, {
          status: 'fail',
          detail: (err && err.message) || 'Runbook failed',
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
      + '<p>One-click ops presets with step status. Prefer these over scattered rebuild buttons.</p>'
      + '</div>'
      + '<div class="hub-settings-grid" id="hub-runbook-grid"></div>'
      + '<div class="hub-card hub-card-wide" style="margin-top:16px">'
      + '<h3>Job status</h3>'
      + '<div id="hub-runbook-log" class="hub-log"></div>'
      + '</div>';

    var grid = container.querySelector('#hub-runbook-grid');
    var logEl = container.querySelector('#hub-runbook-log');
    var busy = false;

    RUNBOOKS.forEach(function (book) {
      var card = document.createElement('div');
      card.className = 'hub-card';
      card.innerHTML = ''
        + '<h3>' + esc(book.title) + '</h3>'
        + '<p class="hub-meta">' + esc(book.desc) + '</p>'
        + '<p class="hub-meta">' + book.steps.length + ' step' + (book.steps.length === 1 ? '' : 's') + '</p>'
        + '<button type="button" class="hub-btn" data-runbook="' + esc(book.id) + '">Run</button>';
      grid.appendChild(card);
    });

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
    RUNBOOKS: RUNBOOKS
  };
})(window);
