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
    return 'hub-st-green';
  }

  function pinFromCtx(ctx) {
    if (typeof ctx.pin === 'function') return ctx.pin();
    return ctx.pin || '';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-dash">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Command Center</h2>'
      + '<p class="hub-dash-sub">System health, pipelines, and recommended actions</p></div>'
      + '<button type="button" class="hub-btn secondary hub-dash-refresh" id="hub-dash-refresh">Refresh</button>'
      + '</div>'
      + '<div id="hub-dash-loading" class="hub-dash-loading">Loading overview…</div>'
      + '<div id="hub-dash-body" class="hidden"></div>'
      + '</div>';

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
          var p;
          if (action === 'qa-run') p = apiPost('/api/qa/run', { force: true });
          else if (action === 'pi-recompute') p = apiPost('/api/product-intel/recompute', {});
          else if (action === 'sr-generate') p = apiPost('/api/self-runner/generate', { runQa: false });
          else if (action === 'hub-cache') p = apiPost('/api/live/refresh', {});
          else if (action === 'recruiting-ingest') p = apiPost('/api/ops/run-job', { jobId: 'recruiting-ingest' });
          else p = Promise.resolve();
          p.then(function () { load(); })
            .catch(function (e) { alert(e.message || 'Action failed'); })
            .finally(function () { btn.disabled = false; });
        });
      });
    }

    function renderOverview(data) {
      var body = document.getElementById('hub-dash-body');
      var env = data.environment === 'prod' ? 'Production' : 'Staging';
      var envCls = data.environment === 'prod' ? 'hub-env-prod' : 'hub-env-stage';

      var issueHtml = (data.topIssues || [])
        .map(function (issue, i) {
          return '<li class="hub-issue ' + statusClass(issue.severity) + '">'
            + '<span class="hub-issue-num">' + (i + 1) + '</span>'
            + '<div class="hub-issue-body">'
            + '<strong>' + esc(issue.title) + '</strong>'
            + (issue.detail ? '<span>' + esc(issue.detail) + '</span>' : '')
            + '<div class="hub-issue-actions">'
            + (issue.route ? '<button type="button" class="hub-link-btn" data-dash-route="' + esc(issue.route) + '">Open module</button>' : '')
            + (issue.actionType ? '<button type="button" class="hub-link-btn" data-dash-action="' + esc(issue.actionType) + '">' + esc(issue.action || 'Fix') + '</button>' : '')
            + '</div></div></li>';
        })
        .join('');

      if (!issueHtml) {
        issueHtml = '<li class="hub-issue hub-st-green"><span class="hub-issue-num">✓</span><div class="hub-issue-body"><strong>All clear</strong><span>No critical issues detected</span></div></li>';
      }

      var moduleCards = Object.keys(data.moduleHealth || {})
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

      var opsTiles = (data.ops && data.ops.tiles) || [];
      var tileHtml = opsTiles.slice(0, 6).map(function (t) {
        return '<div class="hub-stat ' + statusClass(t.status) + '">'
          + '<span class="hub-stat-label">' + esc(t.label) + '</span>'
          + '<span class="hub-stat-val">' + esc(t.summary || t.status) + '</span>'
          + '</div>';
      }).join('');

      var qaPass = data.qa && data.qa.pass;
      var qaLine = qaPass ? '✓ Last crawl passed' : '✗ Failures detected';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide hub-dash-overall ' + statusClass(data.overall) + '">'
        + '<div class="hub-overall-row">'
        + '<div><span class="hub-overall-label">Overall health</span>'
        + '<strong class="hub-overall-val">' + esc((data.overall || 'green').toUpperCase()) + '</strong></div>'
        + '<span class="hub-env-badge ' + envCls + '">' + esc(env) + '</span>'
        + '<span class="hub-dash-ts">Updated ' + esc(new Date(data.updatedAt).toLocaleTimeString()) + '</span>'
        + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Top issues needing attention</h3><ol class="hub-issue-list">' + issueHtml + '</ol></section>'

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

        + '<section class="hub-card hub-card-wide"><h3>Module health</h3><div class="hub-mod-grid">' + moduleCards + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Pipelines</h3><div class="hub-pipe-grid">' + (pipelineHtml || '<p class="hub-meta">No pipeline data</p>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recommended actions</h3><div class="hub-btn-row">' + (actionsHtml || '<span class="hub-meta">No actions suggested</span>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Ops tiles</h3><div class="hub-stat-grid">' + tileHtml + '</div></section>'
        + '</div>';

      body.classList.remove('hidden');
      bindActions(body);
    }

    function load() {
      var loading = document.getElementById('hub-dash-loading');
      var body = document.getElementById('hub-dash-body');
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');

      var pin = pinFromCtx(ctx);
      apiGet('/api/admin/hub/overview?pin=' + encodeURIComponent(pin))
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
