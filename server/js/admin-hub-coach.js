/**
 * Operator Coach — elementary-English advice for the current top issue.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function pickIssue(data) {
    var issues = (data && data.topIssues) || [];
    return issues[0] || null;
  }

  function htmlFromIssue(issue) {
    if (!issue) {
      return '<section class="hub-coach hub-coach--ok" id="hub-coach" aria-label="Operator coach">'
        + '<p class="hub-coach__eyebrow">Coach</p>'
        + '<h3 class="hub-coach__title">You’re clear</h3>'
        + '<p class="hub-coach__plain">No top issue. Keep using Beat Desk for today’s posts.</p>'
        + '</section>';
    }
    var coach = issue.coach || {};
    var title = coach.title || issue.title || 'Top issue';
    var plain = coach.plain || issue.why || issue.detail || 'Needs a look.';
    var how = coach.howTo || issue.fixHowTo || '';
    var steps = Array.isArray(coach.steps) ? coach.steps : [];
    var dont = coach.dontWorry || '';
    var stepsHtml = steps.length
      ? '<ol class="hub-coach__steps">' + steps.map(function (s) {
          return '<li>' + esc(s) + '</li>';
        }).join('') + '</ol>'
      : '';
    var actions = '';
    if (issue.actionType) {
      actions += '<button type="button" class="hub-btn" data-coach-action="' + esc(issue.actionType) + '">'
        + esc(issue.action || 'Run fix') + '</button>';
    }
    if (issue.route) {
      actions += '<button type="button" class="hub-btn secondary" data-coach-route="' + esc(issue.route) + '">'
        + esc(issue.actionType ? 'Open page' : (issue.action || 'Open')) + '</button>';
    }
    var tone = (issue.severity === 'red' || issue.severity === 'fail') ? 'bad' : 'warn';
    return '<section class="hub-coach hub-coach--' + tone + '" id="hub-coach" aria-label="Operator coach">'
      + '<p class="hub-coach__eyebrow">Coach says</p>'
      + '<h3 class="hub-coach__title">' + esc(title) + '</h3>'
      + '<p class="hub-coach__plain">' + esc(plain) + '</p>'
      + (how ? '<p class="hub-coach__howto"><strong>What to do:</strong> ' + esc(how) + '</p>' : '')
      + stepsHtml
      + (dont ? '<p class="hub-coach__calm">' + esc(dont) + '</p>' : '')
      + (actions ? '<div class="hub-coach__actions">' + actions + '</div>' : '')
      + '</section>';
  }

  function renderInto(container, data, opts) {
    if (!container) return;
    opts = opts || {};
    var mount = container.querySelector('#hub-coach-slot') || container;
    mount.innerHTML = htmlFromIssue(pickIssue(data));
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
  }

  global.GVAdminCoach = {
    htmlFromIssue: htmlFromIssue,
    renderInto: renderInto,
    pickIssue: pickIssue
  };
})(window);
