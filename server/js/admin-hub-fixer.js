/**
 * Clear the red — one button for Charles on every Admin Hub page.
 * Wake → fix every safe red tile job → tell him to go post.
 */
(function (global) {
  var TILE_JOBS = {
    'film-room': { id: 'film-room-weekly', label: 'Rebuild Film Room catalog' },
    'recruiting-board': { id: 'recruiting-ingest', label: 'Run recruiting ingest' },
    'portal-tracker': { id: 'portal-ingest', label: 'Re-run portal' },
    'nil-tracker': { id: 'nil-refresh', label: 'Re-run NIL' },
    'depth-gamezone': { id: 'depth-chart-refresh', label: 'Re-run depth chart' },
    'insider-articles': { id: 'article-engine-weekly-draft', label: 'Generate article drafts' }
  };

  var SAFE_JOBS = {
    'film-room-weekly': 1,
    'recruiting-ingest': 1,
    'portal-ingest': 1,
    'nil-refresh': 1,
    'depth-chart-refresh': 1,
    'article-engine-weekly-draft': 1,
    'hub-cache': 1,
    'live-refresh': 1,
    'qa-run': 1
  };

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function isWakeIssue(issue) {
    if (!issue) return false;
    if (issue.mode === 'auto-wait' || issue.mode === 'ignore-ok') return true;
    if (issue.actionType === 'hub-auto-wait') return true;
    if (issue.coach && (issue.coach.mode === 'auto-wait' || issue.coach.mode === 'ignore-ok')) return true;
    var detail = String(issue.detail || '');
    return /0%\s*5xx/i.test(detail) && /\d+ms\s*avg/i.test(detail);
  }

  function isIgnorableIssue(issue) {
    if (!issue) return true;
    if (issue.mode === 'ignore-ok' || (issue.coach && issue.coach.mode === 'ignore-ok')) return true;
    if (isWakeIssue(issue) && issue.severity !== 'red') return true;
    // App Store gate score-only is not an emergency for daily posting.
    if (/App Store gate/i.test(String(issue.title || '')) && issue.severity === 'yellow') return true;
    return false;
  }

  function collectJobs(data) {
    var jobs = [];
    var seen = {};

    function pushJob(id, label) {
      if (!id || !SAFE_JOBS[id] || seen[id]) return;
      if (id === 'pi-recompute') return;
      seen[id] = 1;
      jobs.push({ id: id, label: label || id });
    }

    (data.topIssues || []).forEach(function (issue) {
      if (isIgnorableIssue(issue)) return;
      pushJob(issue.actionType, issue.action);
      if (issue.actionType === 'qa-run') pushJob('qa-run', 'Run QA crawl');
    });

    var tiles = (data.ops && data.ops.tiles) || [];
    tiles.forEach(function (tile) {
      if (!tile || (tile.status !== 'red' && tile.status !== 'yellow')) return;
      if (tile.id === 'api-health' || tile.id === 'db-health') return;
      var mapped = TILE_JOBS[tile.id];
      if (mapped) pushJob(mapped.id, mapped.label);
    });

    return jobs;
  }

  function actionableReds(data) {
    return (data.topIssues || []).filter(function (issue) {
      return issue && issue.severity === 'red' && !isIgnorableIssue(issue);
    });
  }

  function makeItGreen(api) {
    api = api || {};
    var log = typeof api.onProgress === 'function' ? api.onProgress : function () {};
    var fetchApi = global.GVAdminApiFetch;

    log('Clearing the red — waking the server if needed…');

    var wake = Promise.resolve();
    if (fetchApi && fetchApi.ensureAwake) {
      wake = fetchApi.ensureAwake(global.location.origin, {
        retries: 10,
        retryDelayMs: 2500,
        onAttempt: function (info) {
          if (info && info.error) log('Still waking… (' + ((info.attempt || 0) + 1) + ')');
        }
      }).catch(function () {
        log('Server still sleepy — waiting 15 seconds…');
        return sleep(15000).then(function () {
          return fetchApi.ensureAwake(global.location.origin, { retries: 6, retryDelayMs: 2500 });
        });
      });
    }

    return wake
      .then(function () {
        log('Checking what is actually broken…');
        return api.apiGet('/api/admin/hub/overview');
      })
      .then(function (data) {
        var jobs = collectJobs(data);
        var chain = Promise.resolve(data);
        if (!jobs.length) {
          log('Nothing safe to auto-fix. You can go post.');
          return data;
        }
        jobs.forEach(function (job) {
          chain = chain.then(function () {
            log('Fixing: ' + job.label + '…');
            if (job.id === 'qa-run') {
              return api.apiPost('/api/qa/run', { force: true }).then(function () {
                return api.apiGet('/api/admin/hub/overview');
              });
            }
            if (job.id === 'hub-cache' || job.id === 'live-refresh') {
              return api.apiPost('/api/live/refresh', {}).then(function () {
                return api.apiGet('/api/admin/hub/overview');
              });
            }
            return api.apiPost('/api/ops/run-job', { jobId: job.id }).then(function () {
              return api.apiGet('/api/admin/hub/overview');
            });
          });
        });
        return chain;
      })
      .then(function (data) {
        var reds = actionableReds(data);
        var top = (data.topIssues && data.topIssues[0]) || null;
        if (!reds.length) {
          log('Done. Go to Beat Desk and post — ignore yellow wake lag if you still see it.');
          return { ok: true, data: data, next: 'beat-desk', ignoreOk: isIgnorableIssue(top) };
        }
        log('Still red after fixes: ' + reds.map(function (r) { return r.title; }).join(', ') + '. Press Clear the red once more in 2 minutes, or ping support.');
        return { ok: false, data: data, remaining: reds };
      });
  }

  function buttonHtml(label) {
    return '<button type="button" class="hub-btn hub-fixer-btn" data-fixer="1">'
      + (label || 'Clear the red') + '</button>';
  }

  function wire(root, api) {
    if (!root) return;
    root.querySelectorAll('[data-fixer]').forEach(function (btn) {
      if (btn._fixerWired) return;
      btn._fixerWired = true;
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        var prev = btn.textContent;
        var statusEl = document.getElementById('hub-fixer-status')
          || root.querySelector('#hub-fixer-status')
          || document.getElementById('hub-ops-strip-detail');
        function progress(msg) {
          if (statusEl) statusEl.textContent = msg;
          btn.textContent = 'Working…';
        }
        progress('Working…');
        makeItGreen({
          apiGet: api.apiGet,
          apiPost: api.apiPost,
          onProgress: progress,
          onNavigate: api.onNavigate
        })
          .then(function (result) {
            if (result && result.ok) {
              btn.textContent = 'Done — go post';
              if (typeof api.onNavigate === 'function') {
                setTimeout(function () { api.onNavigate('#beat-desk/desk'); }, 600);
              }
            } else {
              btn.textContent = prev || 'Clear the red';
            }
            if (typeof api.onDone === 'function') api.onDone(result);
          })
          .catch(function (e) {
            if (statusEl) statusEl.textContent = (e && e.message) || 'Could not finish — wait 2 minutes and try again.';
            btn.textContent = prev || 'Clear the red';
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    });
  }

  global.GVAdminFixer = {
    makeItGreen: makeItGreen,
    buttonHtml: buttonHtml,
    wire: wire,
    collectJobs: collectJobs,
    isWakeIssue: isWakeIssue,
    isIgnorableIssue: isIgnorableIssue,
    actionableReds: actionableReds
  };
})(window);
