/**
 * Admin Hub — in-shell QA Summary (daily path without full QA iframe).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function statusClass(ok) {
    if (ok === true || ok === 'green') return 'hub-st-green';
    if (ok === false || ok === 'red') return 'hub-st-red';
    if (ok === 'yellow') return 'hub-st-yellow';
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
      + '<div><h2 class="hub-dash-title">QA Summary</h2>'
      + '<p class="hub-dash-sub">Last crawl, failing modules, and open errors</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn" id="hub-qa-sum-run">Run crawl</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-qa-sum-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-qa-sum-full">Full QA</button>'
      + '</div></div>'
      + '<div id="hub-qa-sum-loading" class="hub-dash-loading">Loading QA dashboard…</div>'
      + '<div id="hub-qa-sum-body" class="hidden"></div>'
      + '<p id="hub-qa-sum-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-qa-sum-loading');
    var body = document.getElementById('hub-qa-sum-body');
    var msg = document.getElementById('hub-qa-sum-msg');
    var runBtn = document.getElementById('hub-qa-sum-run');

    document.getElementById('hub-qa-sum-full').addEventListener('click', function () {
      onNavigate('#qa/monitor');
    });
    document.getElementById('hub-qa-sum-refresh').addEventListener('click', load);
    runBtn.addEventListener('click', function () {
      runBtn.disabled = true;
      setMsg('Starting crawl…');
      apiPost('/api/qa/run', { force: true })
        .then(function () {
          setMsg('Crawl started — refreshing…');
          return load();
        })
        .catch(function (e) {
          setMsg(e.message || 'Crawl failed to start', true);
        })
        .finally(function () {
          runBtn.disabled = false;
        });
    });

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(data) {
      var last = data.lastRun || (data.recentRuns && data.recentRuns[0]) || null;
      var pass = last ? !!last.pass : (typeof data.pass === 'boolean' ? data.pass : null);
      var modules = data.moduleStatus || {};
      var errors = data.errors || [];
      var runs = data.recentRuns || [];

      var modHtml = Object.keys(modules).map(function (id) {
        var m = modules[id] || {};
        var ok = m.pass === true || m.status === 'pass' || m.status === 'green';
        var bad = m.pass === false || m.status === 'fail' || m.status === 'red';
        var cls = ok ? 'hub-st-green' : bad ? 'hub-st-red' : 'hub-st-unknown';
        return '<div class="hub-stat ' + cls + '">'
          + '<span class="hub-stat-label">' + esc(id) + '</span>'
          + '<span class="hub-stat-val">' + esc(ok ? 'Pass' : bad ? 'Fail' : (m.status || 'Unknown')) + '</span>'
          + '</div>';
      }).join('');

      var errHtml = errors.slice(0, 8).map(function (e, i) {
        return '<li class="hub-issue hub-st-red">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(e.message || e.title || e.check || 'Error') + '</strong>'
          + '<span>' + esc(e.module || e.path || e.repro || '') + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No open errors</strong><span>Latest crawl looks clean.</span></div></li>';

      var runHtml = runs.slice(0, 5).map(function (r) {
        return '<tr>'
          + '<td>' + esc(fmtTime(r.finishedAt || r.startedAt || r.at)) + '</td>'
          + '<td><span class="hub-env-badge ' + statusClass(r.pass) + '">' + esc(r.pass ? 'Pass' : 'Fail') + '</span></td>'
          + '<td>' + esc(r.failed != null ? r.failed : (r.failCount != null ? r.failCount : '—')) + '</td>'
          + '<td>' + esc(r.durationMs != null ? Math.round(r.durationMs / 1000) + 's' : '—') + '</td>'
          + '</tr>';
      }).join('');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + statusClass(pass) + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Last crawl</span>'
        + '<strong class="hub-overall-val">' + esc(pass === true ? 'PASS' : pass === false ? 'FAIL' : 'UNKNOWN') + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">' + esc(fmtTime(last && (last.finishedAt || last.startedAt))) + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 4px">Failed checks: <strong style="color:#fff">' + esc(last && last.failed != null ? last.failed : (data.failed != null ? data.failed : '—')) + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">Uptime: <strong style="color:#fff">' + esc(data.uptime != null ? data.uptime + '%' : '—') + '</strong>'
        + (data.crawlerBuild ? ' · Build ' + esc(data.crawlerBuild) : '') + '</p>'
        + '</div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-qa-sum-run-inline">Run crawl</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-qa-sum-mobile">Mobile behavior</button>'
        + '</div></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Modules</h3><div class="hub-stat-grid">'
        + (modHtml || '<p class="hub-meta">No module status</p>') + '</div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Open errors</h3><ol class="hub-issue-list">' + errHtml + '</ol></section>'

        + '<section class="hub-card hub-card-wide"><h3>Recent runs</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>When</th><th>Result</th><th>Failed</th><th>Duration</th></tr></thead><tbody>'
        + (runHtml || '<tr><td colspan="4">No recent runs</td></tr>')
        + '</tbody></table></div></section>'
        + '</div>';

      body.classList.remove('hidden');

      var inlineRun = document.getElementById('hub-qa-sum-run-inline');
      if (inlineRun) inlineRun.addEventListener('click', function () { runBtn.click(); });
      var mob = document.getElementById('hub-qa-sum-mobile');
      if (mob) mob.addEventListener('click', function () { onNavigate('#qa/mobile-behavior'); });
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      apiGet('/api/qa/dashboard')
        .then(paint)
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load QA') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminQaSummary = { render: render };
})(window);
