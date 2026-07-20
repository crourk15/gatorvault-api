/**
 * Admin Hub — in-shell Recruiting Alerts Summary (daily path without full alerts iframe).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Recruiting Alerts Summary</h2>'
      + '<p class="hub-dash-sub">Recent events + internal alerts — daily path without the full console</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-al-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-al-daily">Daily Summary</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-al-full">Full Alerts (legacy)</button>'
      + '</div></div>'
      + '<div id="hub-al-loading" class="hub-dash-loading">Loading alerts…</div>'
      + '<div id="hub-al-body" class="hidden"></div>'
      + '<p id="hub-al-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-al-loading');
    var body = document.getElementById('hub-al-body');
    var msg = document.getElementById('hub-al-msg');

    document.getElementById('hub-al-full').addEventListener('click', function () {
      onNavigate('#recruiting/alerts-full');
    });
    document.getElementById('hub-al-daily').addEventListener('click', function () {
      onNavigate('#recruiting/daily');
    });
    document.getElementById('hub-al-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(bundle) {
      var events = (bundle.events && bundle.events.events) || bundle.events || [];
      if (!Array.isArray(events)) events = [];
      var internal = (bundle.internal && bundle.internal.alerts) || bundle.internal || [];
      if (!Array.isArray(internal)) internal = [];
      var health = (bundle.health && bundle.health.report) || bundle.health || {};
      var issues = health.issues || [];
      if (!Array.isArray(issues)) issues = [];
      var counters = health.counters || {};

      var eventHtml = events.slice(0, 20).map(function (e) {
        return '<tr>'
          + '<td>' + esc(fmtTime(e.createdAt || e.at)) + '</td>'
          + '<td>' + esc(e.eventType || e.type || '—') + '</td>'
          + '<td>' + esc(e.title || e.playerSlug || e.name || '—') + '</td>'
          + '<td>' + esc(e.source || e.channel || '—') + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">No recent recruiting events</td></tr>';

      var internalHtml = internal.slice(0, 15).map(function (a, i) {
        return '<li class="hub-issue hub-st-yellow">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(a.title || a.type || a.id || 'Alert') + '</strong>'
          + '<span>' + esc(a.detail || a.message || '') + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No internal alerts</strong><span>Operator inbox is clear.</span></div></li>';

      var issueHtml = issues.slice(0, 8).map(function (iss, i) {
        var title = typeof iss === 'string' ? iss : (iss.title || iss.message || iss.type || 'Issue');
        var detail = typeof iss === 'string' ? '' : (iss.detail || iss.reason || '');
        return '<li class="hub-issue hub-st-yellow">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(title) + '</strong><span>' + esc(detail) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No pipeline issues</strong><span>Ingest looks steady.</span></div></li>';

      var overallCls = internal.length || issues.length ? 'hub-st-yellow' : 'hub-st-green';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + overallCls + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Alert load</span>'
        + '<strong class="hub-overall-val">' + esc(String(events.length + internal.length)) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Events ' + esc(events.length) + ' · Internal ' + esc(internal.length) + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 4px">Fired: <strong style="color:#fff">' + esc(counters.firedEvents != null ? counters.firedEvents : '—') + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">Blocked: <strong style="color:#fff">' + esc(counters.blockedEvents != null ? counters.blockedEvents : '—') + '</strong></p>'
        + '</div></div></section>'

        + '<section class="hub-card"><h3>Internal alerts</h3><ol class="hub-issue-list">' + internalHtml + '</ol></section>'
        + '<section class="hub-card"><h3>Pipeline issues</h3><ol class="hub-issue-list">' + issueHtml + '</ol></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent events</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>When</th><th>Type</th><th>Title</th><th>Source</th></tr></thead><tbody>'
        + eventHtml + '</tbody></table></div></section>'
        + '</div>';

      body.classList.remove('hidden');
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      Promise.all([
        apiGet('/api/recruiting/events?limit=20').catch(function (e) { return { events: [], error: e.message }; }),
        apiGet('/api/recruiting/internal-alerts?limit=20').catch(function (e) { return { alerts: [], error: e.message }; }),
        apiGet('/api/recruiting/pipeline/health').catch(function (e) { return { error: e.message }; })
      ])
        .then(function (rows) {
          paint({ events: rows[0], internal: rows[1], health: rows[2] });
          var errs = [rows[0].error, rows[1].error, rows[2].error].filter(Boolean);
          if (errs.length) setMsg(errs.join(' · '), true);
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load alerts') + '</p>';
            body.classList.remove('hidden');
          }
          setMsg(e.message || 'Failed to load alerts', true);
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminAlertsSummary = { render: render };
})(window);
