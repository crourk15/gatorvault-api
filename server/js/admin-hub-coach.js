/**
 * Operator Coach — sit-tight auto-wait + Make it green for Charles.
 */
(function (global) {
  var _autoWaitTimer = null;
  var _autoWaitTick = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function pickIssue(data) {
    var issues = (data && data.topIssues) || [];
    return issues[0] || null;
  }

  function clearAutoWait() {
    if (_autoWaitTimer) clearTimeout(_autoWaitTimer);
    if (_autoWaitTick) clearInterval(_autoWaitTick);
    _autoWaitTimer = null;
    _autoWaitTick = null;
  }

  function htmlFromIssue(issue, opts) {
    opts = opts || {};
    var fixerBtn = (global.GVAdminFixer && global.GVAdminFixer.buttonHtml)
      ? global.GVAdminFixer.buttonHtml()
      : '';
    if (!issue) {
      return '<section class="hub-coach hub-coach--ok" id="hub-coach" aria-label="Operator coach">'
        + '<p class="hub-coach__eyebrow">Coach</p>'
        + '<h3 class="hub-coach__title">You’re clear</h3>'
        + '<p class="hub-coach__do">Do this now: go to Beat Desk and make today’s posts.</p>'
        + '<div class="hub-coach__actions">'
        + '<button type="button" class="hub-btn" data-coach-route="#beat-desk/desk">Open Beat Desk</button>'
        + fixerBtn
        + '</div>'
        + '<p class="hub-coach__status" id="hub-fixer-status"></p>'
        + '</section>';
    }
    var coach = issue.coach || {};
    var title = coach.title || issue.title || 'Top issue';
    var plain = coach.plain || issue.why || issue.detail || 'Needs a look.';
    var doNow = coach.doThisNow || coach.howTo || issue.fixHowTo || '';
    var steps = Array.isArray(coach.steps) ? coach.steps : [];
    var dont = coach.dontWorry || '';
    var autoWait = coach.autoWaitSec || issue.autoWaitSec || 0;
    var mode = coach.mode || issue.mode || '';
    var stepsHtml = steps.length
      ? '<ol class="hub-coach__steps">' + steps.map(function (s) {
          return '<li>' + esc(s) + '</li>';
        }).join('') + '</ol>'
      : '';
    var countdown = autoWait
      ? '<p class="hub-coach__countdown" id="hub-coach-countdown">Auto-refresh in ' + autoWait + 's…</p>'
      : '';
    var actions = '';
    if (mode === 'auto-wait' || issue.actionType === 'hub-auto-wait') {
      actions += '<button type="button" class="hub-btn secondary" data-coach-action="hub-refresh">Refresh now anyway</button>';
    } else if (issue.actionType && issue.actionType !== 'hub-auto-wait') {
      actions += '<button type="button" class="hub-btn hub-coach__primary" data-coach-action="'
        + esc(issue.actionType) + '">' + esc(issue.action || 'Run fix') + '</button>';
    } else if (issue.route) {
      actions += '<button type="button" class="hub-btn hub-coach__primary" data-coach-route="'
        + esc(issue.route) + '">' + esc(issue.action || 'Open') + '</button>';
    }
    actions += fixerBtn;
    actions += '<button type="button" class="hub-btn secondary" data-coach-route="#beat-desk/desk">Beat Desk</button>';
    var tone = mode === 'auto-wait' ? 'wait' : ((issue.severity === 'red' || issue.severity === 'fail') ? 'bad' : 'warn');
    return '<section class="hub-coach hub-coach--' + tone + '" id="hub-coach" aria-label="Operator coach">'
      + '<p class="hub-coach__eyebrow">Coach — easiest path</p>'
      + '<h3 class="hub-coach__title">' + esc(title) + '</h3>'
      + '<p class="hub-coach__plain">' + esc(plain) + '</p>'
      + (doNow ? '<p class="hub-coach__do"><strong>Do this now:</strong> ' + esc(doNow) + '</p>' : '')
      + countdown
      + stepsHtml
      + (dont ? '<p class="hub-coach__calm"><strong>Ignore:</strong> ' + esc(dont) + '</p>' : '')
      + '<div class="hub-coach__actions">' + actions + '</div>'
      + '<p class="hub-coach__status" id="hub-fixer-status"></p>'
      + '</section>';
  }

  function startAutoWait(issue, opts) {
    clearAutoWait();
    var sec = (issue.coach && issue.coach.autoWaitSec) || issue.autoWaitSec || 0;
    if (!sec || typeof opts.onAction !== 'function') return;
    var left = sec;
    var el = document.getElementById('hub-coach-countdown');
    _autoWaitTick = setInterval(function () {
      left -= 1;
      if (el) el.textContent = left > 0
        ? ('Auto-refresh in ' + left + 's… sit tight.')
        : 'Refreshing…';
      if (left <= 0) clearInterval(_autoWaitTick);
    }, 1000);
    _autoWaitTimer = setTimeout(function () {
      clearAutoWait();
      opts.onAction('hub-refresh');
    }, sec * 1000);
  }

  function renderInto(container, data, opts) {
    if (!container) return;
    opts = opts || {};
    clearAutoWait();
    var mount = container.querySelector('#hub-coach-slot') || container;
    var issue = pickIssue(data);
    mount.innerHTML = htmlFromIssue(issue, opts);
    var root = mount.querySelector('#hub-coach') || mount;

    root.querySelectorAll('[data-coach-route]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var route = btn.getAttribute('data-coach-route');
        if (route && typeof opts.onNavigate === 'function') opts.onNavigate(route);
      });
    });
    root.querySelectorAll('[data-coach-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-coach-action');
        if (action && typeof opts.onAction === 'function') {
          btn.disabled = true;
          Promise.resolve(opts.onAction(action))
            .catch(function (e) { alert((e && e.message) || 'Action failed'); })
            .finally(function () { btn.disabled = false; });
        }
      });
    });

    if (global.GVAdminFixer && typeof global.GVAdminFixer.wire === 'function') {
      global.GVAdminFixer.wire(root, {
        apiGet: opts.apiGet,
        apiPost: opts.apiPost,
        onNavigate: opts.onNavigate,
        onDone: function () {
          if (typeof opts.onAction === 'function') opts.onAction('hub-refresh');
        }
      });
    }

    if (issue && (issue.mode === 'auto-wait' || (issue.coach && issue.coach.mode === 'auto-wait'))) {
      startAutoWait(issue, opts);
    }
  }

  global.GVAdminCoach = {
    htmlFromIssue: htmlFromIssue,
    renderInto: renderInto,
    pickIssue: pickIssue,
    clearAutoWait: clearAutoWait
  };
})(window);
