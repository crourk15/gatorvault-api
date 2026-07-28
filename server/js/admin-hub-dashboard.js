/**
 * Admin Hub — command center dashboard (overview panel).
 */
(function (global) {
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

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};

    var notecardsHtml = (global.GVAdminNotecards && global.GVAdminNotecards.html)
      ? global.GVAdminNotecards.html('command', { onNavigate: onNavigate })
      : '';

    container.innerHTML =
      '<div class="hub-dash">'
      + notecardsHtml
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Command Center</h2>'
      + '<p class="hub-dash-sub">Health + top issues. For daily posts, use Beat Desk (notecards above).</p></div>'
      + '<button type="button" class="hub-btn secondary hub-dash-refresh" id="hub-dash-refresh">Refresh</button>'
      + '</div>'
      + '<div id="hub-dash-loading" class="hub-dash-loading">Loading overview…</div>'
      + '<div id="hub-dash-body" class="hidden"></div>'
      + '</div>';

    if (global.GVAdminNotecards && typeof global.GVAdminNotecards.wire === 'function') {
      global.GVAdminNotecards.wire(container, { onNavigate: onNavigate });
    }

    function runDashAction(action) {
      if (action === 'qa-run') return apiPost('/api/qa/run', { force: true });
      if (action === 'pi-recompute') return apiPost('/api/product-intel/recompute', {});
      if (action === 'sr-generate') return apiPost('/api/self-runner/generate', { runQa: false });
      if (action === 'hub-cache') return apiPost('/api/live/refresh', {});
      if (action === 'recruiting-ingest' || action === 'film-room-weekly' || action === 'portal-ingest' || action === 'nil-refresh' || action === 'depth-chart-refresh' || action === 'article-engine-weekly-draft') {
        return apiPost('/api/ops/run-job', { jobId: action });
      }
      return Promise.resolve();
    }

    function bindActions(root) {
      root.querySelectorAll('[data-dash-route]').forEach(function (el) {
        el.addEventListener('click', function () {
          var route = el.getAttribute('data-dash-route');
          if (route) onNavigate(route);
        });
      });

      root.querySelectorAll('[data-dash-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.getAttribute('data-dash-action');
          btn.disabled = true;
          runDashAction(action)
            .then(function () { load(); })
            .catch(function (e) { alert(e.message || 'Action failed'); })
            .finally(function () { btn.disabled = false; });
        });
      });
    }

    function renderOverview(data) {
      var body = document.getElementById('hub-dash-body');
      var env = data.environment === 'prod' ? 'Production' : 'Staging';
      var envCls = data.environment === 'prod' ? 'hub-env-prod' : 'hub-env-stage';
      var top = (data.topIssues && data.topIssues[0]) || null;
      var primaryAction = (data.recommendedActions && data.recommendedActions[0]) || null;

      var issueHtml = (data.topIssues || [])
        .map(function (issue, i) {
          return '<li class="hub-issue ' + statusClass(issue.severity) + '">'
            + '<span class="hub-issue-num">' + (i + 1) + '</span>'
            + '<div class="hub-issue-body">'
            + '<strong>' + esc(issue.title) + '</strong>'
            + (issue.detail ? '<span>' + esc(issue.detail) + '</span>' : '')
            + (issue.fixHowTo ? '<span style="display:block;margin-top:4px;color:#fde047">What to do: ' + esc(issue.fixHowTo) + '</span>' : '')
            + '<div class="hub-issue-actions">'
            + (issue.actionType
              ? '<button type="button" class="hub-btn" data-dash-action="' + esc(issue.actionType) + '">' + esc(issue.action || 'Run fix') + '</button>'
              : '')
            + (issue.route ? '<button type="button" class="hub-link-btn" data-dash-route="' + esc(issue.route) + '">' + esc(issue.actionType ? 'Open page' : (issue.action || 'Open fix page')) + '</button>' : '')
            + '</div></div></li>';
        })
        .join('');

      if (!issueHtml) {
        issueHtml = '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>All clear</strong><span>No critical issues detected</span></div></li>';
      }

      var moduleCards = Object.keys(data.moduleHealth || {})
        .filter(function (id) { return id.charAt(0) !== '_'; })
        .map(function (id) {
          var st = data.moduleHealth[id];
          var label = id.replace(/-/g, ' ');
          return '<button type="button" class="hub-mod-card ' + statusClass(st) + '" data-dash-route="#' + esc(id) + '">'
            + '<span class="hub-mod-dot"></span>'
            + '<span class="hub-mod-label">' + esc(label) + '</span>'
            + '</button>';
        })
        .join('');

      var pipelineHtml = (data.pipelines || [])
        .map(function (p) {
          return '<div class="hub-pipe ' + statusClass(p.status) + '">'
            + '<span class="hub-pipe-dot"></span>'
            + '<div><strong>' + esc(p.label) + '</strong>'
            + '<span>' + esc(p.summary || '') + '</span></div></div>';
        })
        .join('');

      var actionsHtml = (data.recommendedActions || [])
        .map(function (a) {
          return '<button type="button" class="hub-btn secondary hub-dash-action" data-dash-action="' + esc(a.id) + '">' + esc(a.label) + '</button>';
        })
        .join('');

      var primaryBtn = primaryAction
        ? '<button type="button" class="hub-btn" data-dash-action="' + esc(primaryAction.id) + '">' + esc(primaryAction.label) + '</button>'
        : '<button type="button" class="hub-btn" data-dash-route="#dashboard/runbooks">Open Runbooks</button>';

      var heroIssue = top
        ? '<strong style="display:block;color:#fff;font-size:1rem;margin-bottom:4px">' + esc(top.title) + '</strong>'
          + '<span class="hub-meta" style="margin:0">' + esc(top.detail || 'Needs attention') + '</span>'
          + (top.fixHowTo ? '<span class="hub-meta" style="display:block;margin-top:6px;color:#fde047">What to do: ' + esc(top.fixHowTo) + '</span>' : '')
        : '<strong style="display:block;color:#fff;font-size:1rem;margin-bottom:4px">Systems steady</strong>'
          + '<span class="hub-meta" style="margin:0">No top issue — keep an eye on pipelines below.</span>';

      if (top && top.actionType) {
        primaryBtn = '<button type="button" class="hub-btn" data-dash-action="' + esc(top.actionType) + '">'
          + esc(top.action || 'Run fix') + '</button>';
      }

      var qaPass = data.qa && data.qa.pass;
      var qaLine = qaPass === true ? 'Last crawl passed' : qaPass === false ? 'Failures detected' : 'No crawl signal yet';

      body.innerHTML =
        '<div id="hub-coach-slot"></div>'
        + '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide hub-dash-overall ' + statusClass(data.overall) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Overall health</span>'
        + '<strong class="hub-overall-val">' + esc((data.overall || 'unknown').toUpperCase()) + '</strong>'
        + '<div style="margin-top:8px"><span class="hub-env-badge ' + envCls + '">' + esc(env) + '</span></div>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Updated ' + esc(new Date(data.updatedAt).toLocaleTimeString()) + '</p></div>'
        + '<div>' + heroIssue + '</div>'
        + '<div class="hub-dash-primary">'
        + primaryBtn
        + '<button type="button" class="hub-btn secondary" data-dash-route="#dashboard/runbooks">Runbooks</button>'
        + '</div></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Top issues</h3><ol class="hub-issue-list">' + issueHtml + '</ol></section>'

        + '<section class="hub-card"><h3>QA Monitor</h3>'
        + '<p class="hub-meta">' + qaLine + '</p>'
        + '<p class="hub-meta">Failed: ' + esc(data.qa && data.qa.failed != null ? data.qa.failed : '—') + '</p>'
        + '<button type="button" class="hub-btn secondary" data-dash-route="#qa/monitor">Open QA</button>'
        + '<button type="button" class="hub-btn" data-dash-action="qa-run" style="margin-left:8px">Run crawl</button>'
        + '</section>'

        + '<section class="hub-card"><h3>Product Health</h3>'
        + '<p class="hub-meta">Score: ' + esc(data.productIntel && data.productIntel.overall != null ? data.productIntel.overall : '—') + '</p>'
        + '<p class="hub-meta">Open fixes: ' + esc(data.productIntel && data.productIntel.fixQueueOpen != null ? data.productIntel.fixQueueOpen : 0) + '</p>'
        + '<button type="button" class="hub-btn secondary" data-dash-route="#product-intel/health">Open</button>'
        + '</section>'

        + '<section class="hub-card"><h3>Self-Runner</h3>'
        + '<p class="hub-meta">Pending: ' + esc(data.selfRunner && data.selfRunner.queue ? data.selfRunner.queue.pending : 0) + '</p>'
        + '<p class="hub-meta">Eligible issues: ' + esc(data.selfRunner && data.selfRunner.eligibleOpenIssues != null ? data.selfRunner.eligibleOpenIssues : 0) + '</p>'
        + '<button type="button" class="hub-btn secondary" data-dash-route="#self-runner/pending">Open</button>'
        + '</section>'

        + '<section class="hub-card"><h3>App Store Gate</h3>'
        + '<p class="hub-meta">Progress: ' + esc(data.appStoreGate ? ((data.appStoreGate.consecutiveGreenDays || 0) + '/' + (data.appStoreGate.requiredDays || 7) + ' green days') : '—') + '</p>'
        + '<p class="hub-meta">Today: ' + esc(data.appStoreGate && data.appStoreGate.evaluation ? (data.appStoreGate.evaluation.green ? 'Green' : 'Not green yet') : '—') + '</p>'
        + '<p class="hub-meta">Product Health: ' + esc(data.appStoreGate && data.appStoreGate.evaluation && data.appStoreGate.evaluation.productIntelOverall != null ? data.appStoreGate.evaluation.productIntelOverall : (data.productIntel && data.productIntel.overall != null ? data.productIntel.overall : '—')) + ' (need ' + esc(data.appStoreGate && data.appStoreGate.piMin != null ? data.appStoreGate.piMin : 90) + '+)</p>'
        + '<p class="hub-meta" style="color:#fde047">Internal checklist for a calm App Store week — not a message from Apple.</p>'
        + '<button type="button" class="hub-btn secondary" data-dash-route="#product-intel/summary">Open Product Health</button>'
        + '</section>'

        + '<section class="hub-card hub-card-wide"><h3>Module health</h3><div class="hub-mod-grid">' + moduleCards + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Pipelines</h3><div class="hub-pipe-grid">' + (pipelineHtml || '<p class="hub-meta">No pipeline data</p>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recommended actions</h3><div class="hub-btn-row">' + (actionsHtml || '<span class="hub-meta">No actions suggested</span>') + '</div></section>'
        + '</div>';

      body.classList.remove('hidden');
      bindActions(body);
      if (global.GVAdminCoach && typeof global.GVAdminCoach.renderInto === 'function') {
        global.GVAdminCoach.renderInto(body, data, {
          onNavigate: onNavigate,
          onAction: function (action) {
            return runDashAction(action).then(function () { load(); });
          }
        });
      }

      if (global.GVAdminHub && typeof global.GVAdminHub.applyModuleHealth === 'function') {
        var alertList = (data.alerts && data.alerts.alerts) || [];
        global.GVAdminHub.applyModuleHealth(Object.assign({}, data.moduleHealth || {}, {
          _environment: data.environment,
          _alertCount: alertList.length
        }));
      }
      if (global.GVAdminHub && typeof global.GVAdminHub.applyOpsStrip === 'function') {
        global.GVAdminHub.applyOpsStrip(data);
      }
    }

    function load() {
      var loading = document.getElementById('hub-dash-loading');
      var body = document.getElementById('hub-dash-body');
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');

      apiGet('/api/admin/hub/overview')
        .then(renderOverview)
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message) + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    document.getElementById('hub-dash-refresh').addEventListener('click', load);
    load();
  }

  global.GVAdminDashboard = { render: render };
})(window);
