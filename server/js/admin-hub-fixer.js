/**
 * Make it green — one-button convenience fixer for Charles.
 * Wake → refresh → run safe tile jobs → refresh. No thinking required.
 */
(function (global) {
  var SAFE_JOBS = {
    'film-room-weekly': 1,
    'recruiting-ingest': 1,
    'portal-ingest': 1,
    'nil-refresh': 1,
    'depth-chart-refresh': 1,
    'article-engine-weekly-draft': 1,
    'hub-cache': 1,
    'live-refresh': 1
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function collectJobs(data) {
    var jobs = [];
    var seen = {};
    (data.topIssues || []).forEach(function (issue) {
      var id = issue && issue.actionType;
      if (!id || !SAFE_JOBS[id] || seen[id]) return;
      // Never run product recompute while API is the top red issue.
      if (id === 'pi-recompute') return;
      seen[id] = 1;
      jobs.push({ id: id, label: issue.action || id });
    });
    return jobs;
  }

  function isWakeIssue(issue) {
    if (!issue) return false;
    if (issue.mode === 'auto-wait' || issue.actionType === 'hub-auto-wait') return true;
    if (issue.coach && issue.coach.mode === 'auto-wait') return true;
    var detail = String(issue.detail || '');
    return /0%\s*5xx/i.test(detail) && /\d+ms\s*avg/i.test(detail);
  }

  /**
   * @param {object} api { apiGet, apiPost, onProgress?, onNavigate? }
   */
  function makeItGreen(api) {
    api = api || {};
    var log = typeof api.onProgress === 'function' ? api.onProgress : function () {};
    var fetchApi = global.GVAdminApiFetch;

    log('Starting — waking the server if needed…');

    var wake = Promise.resolve();
    if (fetchApi && fetchApi.ensureAwake) {
      wake = fetchApi.ensureAwake(global.location.origin, {
        retries: 10,
        retryDelayMs: 2500,
        onAttempt: function (info) {
          if (info && info.error) log('Still waking… (' + ((info.attempt || 0) + 1) + ')');
        }
      }).catch(function () {
        log('Server still sleepy — waiting 20 more seconds…');
        return sleep(20000).then(function () {
          return fetchApi.ensureAwake(global.location.origin, { retries: 6, retryDelayMs: 3000 });
        });
      });
    }

    return wake
      .then(function () {
        log('Server answered. Checking health…');
        return api.apiGet('/api/admin/hub/overview');
      })
      .then(function (data) {
        var top = (data.topIssues && data.topIssues[0]) || null;
        if (isWakeIssue(top)) {
          log('Server is up but still slow. Sitting tight 75 seconds (do nothing)…');
          return sleep(75000).then(function () {
            log('Rechecking…');
            return api.apiGet('/api/admin/hub/overview');
          });
        }
        return data;
      })
      .then(function (data) {
        var jobs = collectJobs(data);
        var chain = Promise.resolve(data);
        jobs.forEach(function (job) {
          chain = chain.then(function () {
            log('Fixing: ' + job.label + '…');
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
        if (!jobs.length) log('No safe auto-fix jobs queued.');
        return chain;
      })
      .then(function (data) {
        var overall = (data && data.overall) || 'unknown';
        var top = (data.topIssues && data.topIssues[0]) || null;
        if (overall === 'green' || !top) {
          log('Looking good. Go to Beat Desk and post.');
          return { ok: true, data: data, next: 'beat-desk' };
        }
        if (isWakeIssue(top)) {
          log('Still waking. Sit tight — do not run Deploy recovery. Press Make it green again in 2 minutes if needed.');
          return { ok: false, waking: true, data: data };
        }
        log('Some items still need a look. Follow Coach — or press Make it green again.');
        return { ok: false, data: data };
      });
  }

  function buttonHtml() {
    return '<button type="button" class="hub-btn hub-fixer-btn" id="hub-make-green" data-fixer="1">'
      + 'Make it green</button>';
  }

  function wire(root, api) {
    if (!root) return;
    root.querySelectorAll('[data-fixer], #hub-make-green').forEach(function (btn) {
      if (btn._fixerWired) return;
      btn._fixerWired = true;
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        var statusEl = root.querySelector('#hub-fixer-status');
        function progress(msg) {
          if (statusEl) statusEl.textContent = msg;
        }
        progress('Working…');
        makeItGreen({
          apiGet: api.apiGet,
          apiPost: api.apiPost,
          onProgress: progress,
          onNavigate: api.onNavigate
        })
          .then(function (result) {
            if (result && result.next === 'beat-desk' && typeof api.onNavigate === 'function') {
              // Stay on Command Center so Charles sees green; offer navigation via status.
              progress('Green path done. Open Beat Desk when you want to post.');
            }
            if (typeof api.onDone === 'function') api.onDone(result);
          })
          .catch(function (e) {
            progress((e && e.message) || 'Could not finish — wait 2 minutes and try again.');
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
    isWakeIssue: isWakeIssue
  };
})(window);
