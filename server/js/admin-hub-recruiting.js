/**
 * Admin Hub — in-shell Recruiting daily summary.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Recruiting Daily</h2>'
      + '<p class="hub-dash-sub">Recent alerts, ingest health, and safe pipeline actions</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-rh-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-rh-full">Full Alerts (legacy)</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-rh-mon">Monitoring (legacy)</button>'
      + '</div></div>'
      + '<div id="hub-rh-loading" class="hub-dash-loading">Loading recruiting status...</div>'
      + '<div id="hub-rh-body" class="hidden"></div>'
      + '<p id="hub-rh-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-rh-loading');
    var body = document.getElementById('hub-rh-body');
    var msg = document.getElementById('hub-rh-msg');

    document.getElementById('hub-rh-full').addEventListener('click', function () {
      onNavigate('#recruiting/alerts');
    });
    document.getElementById('hub-rh-mon').addEventListener('click', function () {
      onNavigate('#recruiting/monitoring');
    });
    document.getElementById('hub-rh-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function runJob(jobId, btn) {
      btn.disabled = true;
      setMsg('Running ' + jobId + '...');
      apiPost('/api/ops/run-job', { jobId: jobId })
        .then(function () { setMsg(jobId + ' finished'); return load(); })
        .catch(function (e) { setMsg(e.message || 'Job failed', true); })
        .finally(function () { btn.disabled = false; });
    }

    function paint(bundle) {
      var events = (bundle.events && bundle.events.events) || bundle.events || [];
      if (!Array.isArray(events)) events = [];
      var ingest = bundle.ingest || {};
      var health = (bundle.health && bundle.health.report) || bundle.health || {};
      var internal = (bundle.internal && bundle.internal.alerts) || [];
      if (!Array.isArray(internal)) internal = [];
      var years = ingest.years || {};
      var y26 = years['2026'] || years[2026] || {};
      var y27 = years['2027'] || years[2027] || {};
      var issues = health.issues || [];
      var counters = health.counters || {};

      var eventHtml = events.slice(0, 8).map(function (e) {
        return '<tr>'
          + '<td>' + esc(fmtTime(e.createdAt)) + '</td>'
          + '<td>' + esc(e.eventType || '-') + '</td>'
          + '<td>' + esc(e.title || e.playerSlug || '-') + '</td>'
          + '<td>' + esc(e.source || '-') + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">No recent recruiting events</td></tr>';

      var issueHtml = (Array.isArray(issues) ? issues : []).slice(0, 5).map(function (iss, i) {
        var title = typeof iss === 'string' ? iss : (iss.title || iss.message || iss.type || 'Issue');
        var detail = typeof iss === 'string' ? '' : (iss.detail || iss.reason || '');
        return '<li class="hub-issue hub-st-yellow">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(title) + '</strong><span>' + esc(detail) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No pipeline issues</strong><span>Ingest looks steady.</span></div></li>';

      var internalHtml = internal.slice(0, 5).map(function (a, i) {
        return '<li class="hub-issue hub-st-yellow">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(a.title || a.type || a.id) + '</strong>'
          + '<span>' + esc(a.detail || a.message || '') + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No internal alerts</strong><span>Operator inbox is clear.</span></div></li>';

      var ingestStale = health.ingest && health.ingest.stale;
      var ingestOk = ingest.initialized !== false && !ingestStale;
      var overallCls = issues.length ? 'hub-st-yellow' : (ingestOk ? 'hub-st-green' : 'hub-st-unknown');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + overallCls + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Ingest</span>'
        + '<strong class="hub-overall-val">' + esc(ingest.enabled === false ? 'OFF' : (ingest.initialized ? 'LIVE' : 'INIT')) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Last run ' + esc(fmtTime(ingest.lastRun)) + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 4px">2026 commits: <strong style="color:#fff">' + esc(y26.commitCount != null ? y26.commitCount : '-') + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">2027 commits: <strong style="color:#fff">' + esc(y27.commitCount != null ? y27.commitCount : '-') + '</strong>'
        + (y27.rankings && y27.rankings.nationalRank != null ? ' · Nat #' + esc(y27.rankings.nationalRank) : '')
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" data-rh-job="recruiting-ingest">Run ingest</button>'
        + '<button type="button" class="hub-btn secondary" data-rh-job="portal-ingest">Portal ingest</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-rh-live">Refresh live</button>'
        + '</div></div></section>'

        + '<section class="hub-card"><h3>Pipeline counters</h3>'
        + '<div class="hub-stat-grid">'
        + '<div class="hub-stat"><span class="hub-stat-label">Fired</span><span class="hub-stat-val">' + esc(counters.firedEvents != null ? counters.firedEvents : '-') + '</span></div>'
        + '<div class="hub-stat"><span class="hub-stat-label">Blocked</span><span class="hub-stat-val">' + esc(counters.blockedEvents != null ? counters.blockedEvents : '-') + '</span></div>'
        + '<div class="hub-stat"><span class="hub-stat-label">Verify fails</span><span class="hub-stat-val">' + esc(counters.verificationFailures != null ? counters.verificationFailures : '-') + '</span></div>'
        + '</div></section>'

        + '<section class="hub-card"><h3>Pipeline issues</h3><ol class="hub-issue-list">' + issueHtml + '</ol></section>'
        + '<section class="hub-card"><h3>Internal alerts</h3><ol class="hub-issue-list">' + internalHtml + '</ol></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent events</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>When</th><th>Type</th><th>Title</th><th>Source</th></tr></thead><tbody>'
        + eventHtml + '</tbody></table></div></section>'
        + '</div>';

      body.classList.remove('hidden');

      body.querySelectorAll('[data-rh-job]').forEach(function (btn) {
        btn.addEventListener('click', function () { runJob(btn.getAttribute('data-rh-job'), btn); });
      });
      var liveBtn = document.getElementById('hub-rh-live');
      if (liveBtn) {
        liveBtn.addEventListener('click', function () {
          liveBtn.disabled = true;
          setMsg('Refreshing live hub...');
          apiPost('/api/live/refresh', {})
            .then(function () { setMsg('Live hub refreshed'); })
            .catch(function (e) { setMsg(e.message || 'Refresh failed', true); })
            .finally(function () { liveBtn.disabled = false; });
        });
      }

      if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
        global.GVAdminHub.pushActivity({
          status: 'success',
          message: 'Recruiting daily refreshed',
          subsystem: 'recruiting'
        });
      }
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');

      Promise.all([
        apiGet('/api/recruiting/events?limit=8').catch(function () { return { events: [] }; }),
        apiGet('/api/recruiting/ingest/status').catch(function () { return {}; }),
        apiGet('/api/recruiting/pipeline/health').catch(function () { return {}; }),
        apiGet('/api/recruiting/internal-alerts?limit=8').catch(function () { return { alerts: [] }; })
      ])
        .then(function (rows) {
          paint({ events: rows[0], ingest: rows[1], health: rows[2], internal: rows[3] });
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load recruiting') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminRecruitingSummary = { render: render };
})(window);
