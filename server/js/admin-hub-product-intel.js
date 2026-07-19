/**
 * Admin Hub — in-shell Product Intel fix-queue summary.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sevClass(sev) {
    if (sev === 'critical' || sev === 'high') return 'hub-st-red';
    if (sev === 'medium') return 'hub-st-yellow';
    if (sev === 'low' || sev === 'info') return 'hub-st-green';
    return 'hub-st-unknown';
  }

  function colorClass(color) {
    if (color === 'red') return 'hub-st-red';
    if (color === 'yellow') return 'hub-st-yellow';
    if (color === 'green') return 'hub-st-green';
    return 'hub-st-unknown';
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
      + '<div><h2 class="hub-dash-title">Product Fix Queue</h2>'
      + '<p class="hub-dash-sub">Overall health, open fixes by severity, and recompute</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn" id="hub-pi-recompute">Recompute</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-pi-qa">QA + Recompute</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-pi-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-pi-full">Full console</button>'
      + '</div></div>'
      + '<div id="hub-pi-loading" class="hub-dash-loading">Loading product intel...</div>'
      + '<div id="hub-pi-body" class="hidden"></div>'
      + '<p id="hub-pi-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-pi-loading');
    var body = document.getElementById('hub-pi-body');
    var msg = document.getElementById('hub-pi-msg');

    document.getElementById('hub-pi-full').addEventListener('click', function () {
      onNavigate('#product-intel/health');
    });
    document.getElementById('hub-pi-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function recompute(runQaFirst, btn) {
      btn.disabled = true;
      setMsg(runQaFirst ? 'Running QA then recompute...' : 'Recomputing...');
      apiPost('/api/product-intel/recompute', { force: true, runQaFirst: !!runQaFirst })
        .then(function () {
          setMsg('Recompute finished');
          if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
            global.GVAdminHub.pushActivity({
              status: 'success',
              message: runQaFirst ? 'Product Intel QA + recompute finished' : 'Product Intel recompute finished',
              subsystem: 'product-intel'
            });
          }
          return load();
        })
        .catch(function (e) { setMsg(e.message || 'Recompute failed', true); })
        .finally(function () { btn.disabled = false; });
    }

    document.getElementById('hub-pi-recompute').addEventListener('click', function () {
      recompute(false, this);
    });
    document.getElementById('hub-pi-qa').addEventListener('click', function () {
      recompute(true, this);
    });

    function paint(bundle) {
      var scores = bundle.scores || {};
      var queue = bundle.queue || {};
      var summary = (bundle.summary && bundle.summary.summary) || bundle.summary || {};
      var layers = (bundle.layers && bundle.layers.layers) || bundle.layers || {};
      var items = queue.items || [];
      var bySev = queue.bySeverity || {};
      var stale = !!(bundle.summary && bundle.summary.stale);

      var itemHtml = items.slice(0, 8).map(function (it, i) {
        return '<li class="hub-issue ' + sevClass(it.severity) + '">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(it.title || it.id) + '</strong>'
          + '<span>' + esc((it.severity || '').toUpperCase() + ' · ' + (it.classification || it.module || '') + (it.suggestedFix ? ' · ' + it.suggestedFix : '')) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>Fix queue empty</strong><span>No open product issues.</span></div></li>';

      var topIssues = summary.topIssues || [];
      var topHtml = topIssues.slice(0, 5).map(function (it, i) {
        return '<li class="hub-issue ' + sevClass(it.severity) + '">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(it.message || it.id) + '</strong>'
          + '<span>' + esc((it.severity || '') + ' · ' + (it.module || '')) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No top issues</strong><span>Summary is clean.</span></div></li>';

      var sev = layers.severity || {};
      var approval = layers.approvalGate || '-';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + colorClass(scores.color) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Overall</span>'
        + '<strong class="hub-overall-val">' + esc(scores.overall != null ? scores.overall : '-') + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">' + esc(stale ? 'Stale — recompute recommended' : ('Updated ' + fmtTime(scores.lastComputedAt))) + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 4px">Open fixes: <strong style="color:#fff">' + esc(queue.total != null ? queue.total : items.length) + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">Critical ' + esc(bySev.critical || 0)
        + ' · High ' + esc(bySev.high || 0)
        + ' · Med ' + esc(bySev.medium || 0)
        + ' · Low ' + esc(bySev.low || 0) + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-pi-recompute-inline">Recompute</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-pi-self">Self-Runner</button>'
        + '</div></div></section>'

        + '<section class="hub-card"><h3>Layers</h3>'
        + '<p class="hub-meta">Severity C/H/M/L: ' + esc([sev.critical || 0, sev.high || 0, sev.medium || 0, sev.low || 0].join('/')) + '</p>'
        + '<p class="hub-meta">Proposals: ' + esc(layers.proposals != null ? layers.proposals : '-') + '</p>'
        + '<p class="hub-meta">Approval gate: ' + esc(approval) + '</p>'
        + '</section>'

        + '<section class="hub-card"><h3>Top summary issues</h3><ol class="hub-issue-list">' + topHtml + '</ol></section>'
        + '<section class="hub-card hub-card-wide"><h3>Open fix queue</h3><ol class="hub-issue-list">' + itemHtml + '</ol></section>'
        + '</div>';

      body.classList.remove('hidden');

      var inline = document.getElementById('hub-pi-recompute-inline');
      if (inline) inline.addEventListener('click', function () { document.getElementById('hub-pi-recompute').click(); });
      var selfBtn = document.getElementById('hub-pi-self');
      if (selfBtn) selfBtn.addEventListener('click', function () { onNavigate('#self-runner/pending'); });
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      Promise.all([
        apiGet('/api/product-intel/scores').catch(function () { return {}; }),
        apiGet('/api/product-intel/fix-queue').catch(function () { return { items: [] }; }),
        apiGet('/api/product-intel/summary').catch(function () { return {}; }),
        apiGet('/api/product-intel/layers').catch(function () { return {}; })
      ])
        .then(function (rows) {
          paint({ scores: rows[0], queue: rows[1], summary: rows[2], layers: rows[3] });
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load product intel') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminProductIntelSummary = { render: render };
})(window);
