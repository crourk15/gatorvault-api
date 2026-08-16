/**
 * Admin Hub — in-shell Ops Summary (daily path without full ops iframe).
 */
(function (global) {
  var SAFE_JOBS = [
    { id: 'live-refresh', label: 'Live refresh' },
    { id: 'recruiting-ingest', label: 'Recruiting ingest' },
    { id: 'portal-ingest', label: 'Portal ingest' },
    { id: 'qa-crawler', label: 'QA crawler' },
    { id: 'film-room-weekly', label: 'Film Room rebuild' },
    { id: 'product-intel-recompute', label: 'Product Intel recompute' },
    { id: 'ops-healthcheck', label: 'Ops healthcheck' },
    { id: 'vault-feed-2028-sweep', label: 'Vault feed 2028+ (7am/7pm)' },
    { id: 'allowlist-intel-sweep', label: 'Allowlist intel sweep' }
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function statusClass(status) {
    if (status === 'red') return 'hub-st-red';
    if (status === 'yellow') return 'hub-st-yellow';
    if (status === 'green') return 'hub-st-green';
    return 'hub-st-unknown';
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Ops Summary</h2>'
      + '<p class="hub-dash-sub">Tiles, cron freshness, and safe re-runs — full console stays one tab away</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-ops-sum-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-ops-sum-full">Full Ops</button>'
      + '</div></div>'
      + '<div id="hub-ops-sum-loading" class="hub-dash-loading">Loading ops status…</div>'
      + '<div id="hub-ops-sum-body" class="hidden"></div>'
      + '<p id="hub-ops-sum-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-ops-sum-loading');
    var body = document.getElementById('hub-ops-sum-body');
    var msg = document.getElementById('hub-ops-sum-msg');

    document.getElementById('hub-ops-sum-full').addEventListener('click', function () {
      onNavigate('#dashboard/ops');
    });
    document.getElementById('hub-ops-sum-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function runJob(jobId, btn) {
      if (!jobId) return;
      btn.disabled = true;
      setMsg('Running ' + jobId + '…');
      apiPost('/api/ops/run-job', { jobId: jobId })
        .then(function () {
          setMsg(jobId + ' finished');
          return load();
        })
        .catch(function (e) {
          setMsg(e.message || 'Job failed', true);
        })
        .finally(function () {
          btn.disabled = false;
        });
    }

    function paint(data) {
      var ops = data.ops || data;
      var tiles = ops.tiles || [];
      var cronJobs = ops.cronJobs || [];
      var alerts = (ops.alerts && ops.alerts.alerts) || ops.alerts || [];
      if (!Array.isArray(alerts)) alerts = [];
      var pipelines = data.pipelines || [];

      var tileFixJobs = {
        'film-room': { job: 'film-room-weekly', label: 'Rebuild Film Room catalog' },
        'recruiting-board': { job: 'recruiting-ingest', label: 'Run recruiting ingest' },
        'portal-tracker': { job: 'portal-ingest', label: 'Re-run portal' },
        'nil-tracker': { job: 'nil-refresh', label: 'Re-run NIL' },
        'depth-gamezone': { job: 'depth-chart-refresh', label: 'Re-run depth' },
        'insider-articles': { job: 'article-engine-weekly-draft', label: 'Generate drafts' }
      };
      var tileHtml = tiles.map(function (t) {
        var fix = tileFixJobs[t.id];
        var needsFix = t.status === 'red' || t.status === 'yellow';
        return '<div class="hub-stat ' + statusClass(t.status) + '">'
          + '<span class="hub-stat-label">' + esc(t.label || t.id) + '</span>'
          + '<span class="hub-stat-val">' + esc(t.summary || t.status || '—') + '</span>'
          + (needsFix && fix
            ? '<button type="button" class="hub-btn" style="margin-top:8px" data-ops-job="' + esc(fix.job) + '">' + esc(fix.label) + '</button>'
            : '')
          + '</div>';
      }).join('');

      var cronHtml = cronJobs.slice(0, 12).map(function (j) {
        return '<tr>'
          + '<td>' + esc(j.label || j.id) + '</td>'
          + '<td><span class="hub-env-badge ' + statusClass(j.status) + '">' + esc(j.status || 'unknown') + '</span></td>'
          + '<td>' + esc(fmtTime(j.lastRunAt || j.lastSuccessAt || j.updatedAt)) + '</td>'
          + '</tr>';
      }).join('');

      var pipeHtml = pipelines.map(function (p) {
        return '<div class="hub-stat ' + statusClass(p.status) + '">'
          + '<span class="hub-stat-label">' + esc(p.label || p.id) + '</span>'
          + '<span class="hub-stat-val">' + esc(p.summary || p.status || '—') + '</span>'
          + '</div>';
      }).join('');

      var alertHtml = alerts.slice(0, 6).map(function (a) {
        return '<li class="hub-issue ' + statusClass(a.severity || a.status || 'yellow') + '">'
          + '<span class="hub-issue-num">!</span>'
          + '<div class="hub-issue-body"><strong>' + esc(a.title || a.message || a.id) + '</strong>'
          + '<span>' + esc(a.detail || a.subsystem || '') + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No recent alerts</strong><span>Ops strip stays quiet.</span></div></li>';

      var jobBtns = SAFE_JOBS.map(function (j) {
        return '<button type="button" class="hub-btn secondary" data-ops-job="' + esc(j.id) + '">' + esc(j.label) + '</button>';
      }).join('');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + statusClass(ops.overall || data.overall) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Ops overall</span>'
        + '<strong class="hub-overall-val">' + esc(String(ops.overall || data.overall || 'unknown').toUpperCase()) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Updated ' + esc(fmtTime(ops.updatedAt || data.updatedAt)) + '</p></div>'
        + '<div><strong style="display:block;color:#fff;margin-bottom:4px">Safe re-runs</strong>'
        + '<span class="hub-meta" style="margin:0">Common jobs only — force-post and identity tools stay in Full Ops.</span></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" data-ops-job="live-refresh">Refresh live hub</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-ops-sum-runbooks">Runbooks</button>'
        + '</div></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Health tiles</h3><div class="hub-stat-grid">'
        + (tileHtml || '<p class="hub-meta">No tile data</p>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Pipelines</h3><div class="hub-stat-grid">'
        + (pipeHtml || '<p class="hub-meta">No pipeline data</p>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Run job</h3><div class="hub-btn-row">' + jobBtns + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Cron freshness</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Job</th><th>Status</th><th>Last</th></tr></thead><tbody>'
        + (cronHtml || '<tr><td colspan="3">No cron data</td></tr>')
        + '</tbody></table></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent alerts</h3><ol class="hub-issue-list">' + alertHtml + '</ol></section>'
        + '</div>';

      body.classList.remove('hidden');

      var rb = document.getElementById('hub-ops-sum-runbooks');
      if (rb) rb.addEventListener('click', function () { onNavigate('#dashboard/runbooks'); });

      body.querySelectorAll('[data-ops-job]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runJob(btn.getAttribute('data-ops-job'), btn);
        });
      });
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      apiGet('/api/admin/hub/overview')
        .then(paint)
        .catch(function () {
          return apiGet('/api/ops/status').then(paint);
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load ops') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminOpsSummary = { render: render };
})(window);
