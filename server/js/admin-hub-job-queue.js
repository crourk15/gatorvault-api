/**
 * Admin Hub — in-shell Job Queue + safe ops actions.
 */
(function (global) {
  var SAFE_JOBS = [
    'live-refresh',
    'recruiting-ingest',
    'portal-ingest',
    'nil-refresh',
    'film-room-weekly',
    'depth-chart-refresh',
    'game-zone-refresh',
    'qa-crawler',
    'product-intel-recompute',
    'ops-healthcheck',
    'api-keepalive',
    'platform-health-sweep',
    'feed-repair',
    'vault-feed-2028-sweep',
    'allowlist-intel-sweep'
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function statusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'error' || s === 'fail' || s === 'failed' || s === 'red') return 'hub-st-red';
    if (s === 'warning' || s === 'warn' || s === 'yellow') return 'hub-st-yellow';
    if (s === 'success' || s === 'ok' || s === 'green') return 'hub-st-green';
    if (s === 'started' || s === 'running') return 'hub-st-unknown';
    return 'hub-st-unknown';
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function pushAct(ctx, entry) {
    if (ctx && typeof ctx.pushActivity === 'function') ctx.pushActivity(entry);
    else if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
      global.GVAdminHub.pushActivity(entry);
    }
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Job Queue</h2>'
      + '<p class="hub-dash-sub">Safe re-runs, heartbeat status, and recent ops activity</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-jobs-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-jobs-full">Full Ops</button>'
      + '</div></div>'
      + '<div id="hub-jobs-loading" class="hub-dash-loading">Loading jobs...</div>'
      + '<div id="hub-jobs-body" class="hidden"></div>'
      + '<p id="hub-jobs-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-jobs-loading');
    var body = document.getElementById('hub-jobs-body');
    var msg = document.getElementById('hub-jobs-msg');

    document.getElementById('hub-jobs-full').addEventListener('click', function () {
      onNavigate('#dashboard/ops');
    });
    document.getElementById('hub-jobs-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function runJob(jobId, btn) {
      if (!jobId || SAFE_JOBS.indexOf(jobId) < 0) {
        setMsg('Job not allowed in-shell', true);
        return;
      }
      btn.disabled = true;
      setMsg('Running ' + jobId + '...');
      pushAct(ctx, { status: 'running', message: 'Started ' + jobId, subsystem: 'ops-jobs' });
      apiPost('/api/ops/run-job', { jobId: jobId })
        .then(function (res) {
          var ok = !(res && res.ok === false);
          setMsg(jobId + (ok ? ' finished' : ' finished with warnings'));
          pushAct(ctx, {
            status: ok ? 'success' : 'warning',
            message: jobId + (ok ? ' completed' : ' completed with issues'),
            subsystem: 'ops-jobs'
          });
          return load();
        })
        .catch(function (e) {
          setMsg(e.message || 'Job failed', true);
          pushAct(ctx, { status: 'error', message: jobId + ' failed: ' + (e.message || 'error'), subsystem: 'ops-jobs' });
        })
        .finally(function () { btn.disabled = false; });
    }

    function paint(bundle) {
      var jobs = (bundle.jobs && bundle.jobs.jobs) || bundle.jobs || [];
      if (!Array.isArray(jobs)) jobs = [];
      var status = bundle.status || {};
      var logs = (bundle.logs && bundle.logs.events) || [];
      if (!Array.isArray(logs)) logs = [];

      var byId = {};
      jobs.forEach(function (j) { byId[j.id] = j; });

      var rows = SAFE_JOBS.map(function (id) {
        var j = byId[id] || { id: id, label: id };
        var hb = j.heartbeat || {};
        var st = hb.lastStatus || j.status || 'unknown';
        return '<tr>'
          + '<td><strong style="color:#fff">' + esc(j.label || id) + '</strong>'
          + '<div class="hub-meta" style="margin:2px 0 0">' + esc(id) + (j.schedule ? ' · ' + esc(j.schedule) : '') + '</div></td>'
          + '<td><span class="hub-env-badge ' + statusClass(st) + '">' + esc(st) + '</span></td>'
          + '<td>' + esc(fmtTime(hb.lastRun || hb.lastSuccess || hb.lastStarted)) + '</td>'
          + '<td>' + esc(hb.lastMessage || '-') + '</td>'
          + '<td><button type="button" class="hub-btn secondary" data-job-id="' + esc(id) + '">Run</button></td>'
          + '</tr>';
      }).join('');

      var logHtml = logs.slice(0, 12).map(function (ev) {
        return '<li class="hub-issue ' + statusClass(ev.status) + '">'
          + '<span class="hub-issue-num">' + esc((ev.status || '?').slice(0, 3).toUpperCase()) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(ev.message || ev.id) + '</strong>'
          + '<span>' + esc(fmtTime(ev.timestamp) + (ev.subsystem ? ' · ' + ev.subsystem : '')) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No recent logs</strong><span>Queue is quiet.</span></div></li>';

      var tiles = status.tiles || [];
      var redTiles = tiles.filter(function (t) { return t.status === 'red' || t.status === 'yellow'; }).slice(0, 4);
      var tileHtml = redTiles.map(function (t) {
        return '<div class="hub-stat ' + statusClass(t.status) + '">'
          + '<span class="hub-stat-label">' + esc(t.label || t.id) + '</span>'
          + '<span class="hub-stat-val">' + esc(t.summary || t.status) + '</span></div>';
      }).join('') || '<p class="hub-meta">No yellow/red tiles</p>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + statusClass(status.overall) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Ops overall</span>'
        + '<strong class="hub-overall-val">' + esc(String(status.overall || 'unknown').toUpperCase()) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Updated ' + esc(fmtTime(status.updatedAt)) + '</p></div>'
        + '<div><strong style="display:block;color:#fff;margin-bottom:4px">In-shell policy</strong>'
        + '<span class="hub-meta" style="margin:0">Safe jobs only. Force-post, detectives, identity overrides, and article approve stay in Full Ops.</span></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" data-job-id="live-refresh">Refresh live</button>'
        + '<button type="button" class="hub-btn secondary" data-job-id="ops-healthcheck">Healthcheck</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-jobs-eval">Evaluate alerts</button>'
        + '</div></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Attention tiles</h3><div class="hub-stat-grid">' + tileHtml + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Safe jobs</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>'
        + '<th>Job</th><th>Status</th><th>Last</th><th>Message</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent ops logs</h3><ol class="hub-issue-list">' + logHtml + '</ol></section>'
        + '</div>';

      body.classList.remove('hidden');

      body.querySelectorAll('[data-job-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runJob(btn.getAttribute('data-job-id'), btn);
        });
      });

      var evalBtn = document.getElementById('hub-jobs-eval');
      if (evalBtn) {
        evalBtn.addEventListener('click', function () {
          evalBtn.disabled = true;
          setMsg('Evaluating alerts...');
          apiGet('/api/ops/status?evaluateAlerts=1')
            .then(function () {
              setMsg('Alerts evaluated');
              pushAct(ctx, { status: 'success', message: 'Ops alerts evaluated', subsystem: 'ops' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Evaluate failed', true); })
            .finally(function () { evalBtn.disabled = false; });
        });
      }
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      Promise.all([
        apiGet('/api/ops/jobs').catch(function () { return { jobs: [] }; }),
        apiGet('/api/ops/status').catch(function () { return {}; }),
        apiGet('/api/ops/logs?limit=12').catch(function () { return { events: [] }; })
      ])
        .then(function (rows) {
          paint({ jobs: rows[0], status: rows[1], logs: rows[2] });
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load jobs') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminJobQueue = { render: render, SAFE_JOBS: SAFE_JOBS };
})(window);
