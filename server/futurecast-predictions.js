(function () {
  'use strict';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
  var POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];
  var CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
  var STATUSES = [{ value: 'ACTIVE', label: 'Active' }, { value: 'HIT', label: 'Hit' }, { value: 'MISS', label: 'Miss' }];
  var state = { classYear: 2026, position: '', status: 'ACTIVE' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function sourceLabel(t) {
    return { MODEL: 'Model', STAFF: 'Staff', FAN: 'Fan', BLENDED: 'Blended' }[t] || t;
  }

  function buildUrl() {
    var p = new URLSearchParams();
    p.set('class_year', String(state.classYear));
    if (state.position) p.set('position', state.position);
    if (state.status) p.set('status', state.status);
    p.set('limit', '100');
    p.set('refresh', 'true');
    return API + '/api/predictions?' + p.toString();
  }

  function renderToolbar() {
    document.getElementById('toolbar').innerHTML =
      '<label>Class<select id="f-class">' + CLASS_YEARS.map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select></label>' +
      '<label>Position<select id="f-pos">' + POSITIONS.map(function (p) { return '<option value="' + p + '">' + (p || 'All') + '</option>'; }).join('') + '</select></label>' +
      '<label>Status<select id="f-status">' + STATUSES.map(function (s) { return '<option value="' + s.value + '">' + s.label + '</option>'; }).join('') + '</select></label>';
    document.getElementById('f-class').value = String(state.classYear);
    document.getElementById('f-status').value = state.status;
    ['f-class', 'f-pos', 'f-status'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function (e) {
        if (id === 'f-class') state.classYear = Number(e.target.value);
        if (id === 'f-pos') state.position = e.target.value;
        if (id === 'f-status') state.status = e.target.value;
        load();
      });
    });
  }

  function renderGrid(predictions) {
    var status = document.getElementById('status');
    var grid = document.getElementById('grid');
    if (!predictions.length) { status.textContent = 'No predictions match these filters.'; grid.innerHTML = ''; return; }
    status.textContent = '';
    grid.innerHTML = predictions.map(function (p) {
      return '<a class="fc-prediction-card" href="/futurecast/player/' + encodeURIComponent(p.playerSlug) + '">' +
        '<div class="fc-prediction-card__head"><span class="fc-prediction-card__confidence">' + p.confidence + '%</span>' +
        '<span class="fc-pred-source fc-pred-source--' + p.sourceType.toLowerCase() + '">' + esc(sourceLabel(p.sourceType)) + '</span></div>' +
        '<h3 class="fc-prediction-card__name">' + esc(p.fullName) + '</h3>' +
        '<p class="fc-prediction-card__meta">' + esc(p.position) + ' · ' + p.classYear + '</p>' +
        '<p class="fc-prediction-card__school">' + esc(p.school) + '</p>' +
        '<div class="fc-prediction-item__bar-wrap"><div class="fc-prediction-item__bar" style="width:' + p.confidence + '%"></div></div>' +
        '<span class="fc-pred-status fc-pred-status--' + p.status.toLowerCase() + '">' + esc(p.status) + '</span></a>';
    }).join('');
  }

  function load() {
    document.getElementById('status').textContent = 'Loading FutureCast Picks…';
    fetch(buildUrl()).then(function (r) { return r.ok ? r.json() : r.json().then(function (b) { throw new Error(b.error); }); })
      .then(function (d) { renderGrid(d.predictions || []); })
      .catch(function (e) { document.getElementById('status').textContent = e.message || 'Failed'; });
  }

  renderToolbar();
  load();
})();
