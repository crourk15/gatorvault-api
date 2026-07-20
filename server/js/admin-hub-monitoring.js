/**
 * Admin Hub — in-shell Monitoring Summary (daily path without full monitoring iframe).
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

  function statusClass(level) {
    var s = String(level || '').toLowerCase();
    if (s === 'green' || s === 'ok' || s === 'pass' || s === 'healthy') return 'hub-st-green';
    if (s === 'yellow' || s === 'warn' || s === 'warning' || s === 'degraded') return 'hub-st-yellow';
    if (s === 'red' || s === 'fail' || s === 'error' || s === 'critical') return 'hub-st-red';
    return 'hub-st-unknown';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Monitoring Summary</h2>'
      + '<p class="hub-dash-sub">Healthcheck + recent internal alerts — daily path without the full console</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-mon-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-mon-full">Full Monitoring (legacy)</button>'
      + '</div></div>'
      + '<div id="hub-mon-loading" class="hub-dash-loading">Loading monitoring…</div>'
      + '<div id="hub-mon-body" class="hidden"></div>'
      + '<p id="hub-mon-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-mon-loading');
    var body = document.getElementById('hub-mon-body');
    var msg = document.getElementById('hub-mon-msg');

    document.getElementById('hub-mon-full').addEventListener('click', function () {
      onNavigate('#recruiting/monitoring-full');
    });
    document.getElementById('hub-mon-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(bundle) {
      var report = (bundle.health && bundle.health.report) || bundle.health || {};
      var alerts = (bundle.alerts && bundle.alerts.alerts) || bundle.alerts || [];
      if (!Array.isArray(alerts)) alerts = [];

      var overall = report.status || report.overall || report.level || (report.ok === false ? 'red' : report.ok === true ? 'green' : 'unknown');
      var issues = report.issues || report.checks || [];
      if (!Array.isArray(issues)) issues = [];

      var issueHtml = issues.slice(0, 8).map(function (issue, i) {
        var title = issue.title || issue.name || issue.check || issue.id || 'Check';
        var detail = issue.detail || issue.message || issue.status || '';
        var cls = statusClass(issue.status || issue.level || issue.ok);
        return '<li class="hub-issue ' + cls + '">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(title) + '</strong>'
          + '<span>' + esc(detail) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No open issues</strong><span>Healthcheck looks clean.</span></div></li>';

      var alertHtml = alerts.slice(0, 10).map(function (a) {
        return '<tr>'
          + '<td>' + esc(fmtTime(a.createdAt || a.at || a.ts)) + '</td>'
          + '<td>' + esc(a.level || a.severity || a.type || '—') + '</td>'
          + '<td>' + esc(a.title || a.message || a.name || '—') + '</td>'
          + '<td>' + esc(a.source || a.module || '—') + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">No recent monitoring alerts</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + statusClass(overall) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Health</span>'
        + '<strong class="hub-overall-val">' + esc(String(overall).toUpperCase()) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">' + esc(fmtTime(report.checkedAt || report.at || report.generatedAt)) + '</p></div>'
        + '<div><p class="hub-meta" style="margin:0">Issues: <strong style="color:#fff">' + esc(issues.length) + '</strong></p>'
        + '<p class="hub-meta" style="margin:6px 0 0">Alerts: <strong style="color:#fff">' + esc(alerts.length) + '</strong></p></div>'
        + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Health issues</h3><ol class="hub-issue-list">' + issueHtml + '</ol></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent alerts</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>When</th><th>Level</th><th>Alert</th><th>Source</th></tr></thead><tbody>'
        + alertHtml
        + '</tbody></table></div></section>'
        + '</div>';

      body.classList.remove('hidden');
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      Promise.all([
        apiGet('/api/internal/monitoring/healthcheck').catch(function (e) {
          return { ok: false, error: e.message || 'healthcheck failed' };
        }),
        apiGet('/api/internal/monitoring/alerts?limit=20').catch(function (e) {
          return { ok: false, alerts: [], error: e.message || 'alerts failed' };
        })
      ])
        .then(function (parts) {
          var health = parts[0] || {};
          var alerts = parts[1] || {};
          if (health.error && alerts.error) {
            throw new Error(health.error || alerts.error);
          }
          paint({ health: health, alerts: alerts });
          if (health.error || alerts.error) {
            setMsg((health.error || '') + (alerts.error ? (' · ' + alerts.error) : ''), true);
          }
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load monitoring') + '</p>';
            body.classList.remove('hidden');
          }
          setMsg(e.message || 'Failed to load monitoring', true);
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminMonitoringSummary = { render: render };
})(window);
