(function () {
  'use strict';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
  var POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];
  var CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
  var state = { classYear: 2026, position: '', sort: 'likelihood', likelihoodMin: 0.25 };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function pct(v) { return Math.round((v <= 1 ? v * 100 : v)); }
  function band(p) { return p >= 70 ? 'high' : p >= 40 ? 'medium' : 'low'; }

  function buildUrl() {
    var p = new URLSearchParams();
    p.set('class_year', String(state.classYear));
    if (state.position) p.set('position', state.position);
    p.set('sort', state.sort);
    p.set('likelihood_min', String(state.likelihoodMin));
    p.set('limit', '100');
    return API + '/api/portal/watchlist?' + p.toString();
  }

  function renderToolbar() {
    var el = document.getElementById('toolbar');
    el.innerHTML =
      '<label>Class<select id="f-class">' + CLASS_YEARS.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') + '</select></label>' +
      '<label>Position<select id="f-pos">' + POSITIONS.map(function (p) { return '<option value="' + p + '">' + (p || 'All') + '</option>'; }).join('') + '</select></label>' +
      '<label>Sort<select id="f-sort"><option value="likelihood">Likelihood</option><option value="volatility">Volatility</option><option value="depthChartRisk">Depth Risk</option></select></label>' +
      '<label>Min %<select id="f-min"><option value="0">All</option><option value="0.25">25%+</option><option value="0.5">50%+</option></select></label>';
    document.getElementById('f-class').value = String(state.classYear);
    document.getElementById('f-sort').value = state.sort;
    document.getElementById('f-min').value = String(state.likelihoodMin);
    ['f-class', 'f-pos', 'f-sort', 'f-min'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function (e) {
        if (id === 'f-class') state.classYear = Number(e.target.value);
        if (id === 'f-pos') state.position = e.target.value;
        if (id === 'f-sort') state.sort = e.target.value;
        if (id === 'f-min') state.likelihoodMin = Number(e.target.value);
        load();
      });
    });
  }

  function renderGrid(players) {
    var status = document.getElementById('status');
    var grid = document.getElementById('grid');
    if (!players.length) {
      status.textContent = 'No portal candidates match these filters.';
      grid.innerHTML = '';
      return;
    }
    status.textContent = '';
    grid.innerHTML = players.map(function (p) {
      var pc = pct(p.portalLikelihood);
      return '<a class="fc-portal-card" href="/futurecast/player/' + encodeURIComponent(p.slug) + '?tab=portal">' +
        '<span style="color:#c4b5fd;font-size:0.75rem;font-weight:700">#' + p.rank + '</span>' +
        '<h3 class="fc-portal-card__name">' + esc(p.fullName) + '</h3>' +
        '<p style="color:#94a3b8;font-size:0.8125rem;margin:0 0 0.75rem">' + esc(p.position) + ' · ' + p.classYear + '</p>' +
        '<span class="fc-portal-badge fc-portal-badge--' + band(pc) + '">Portal ' + pc + '%</span>' +
        '<span class="fc-portal-metric">Risk ' + p.depthChartRisk + '</span>' +
        '<span class="fc-portal-metric">Vol ' + p.volatility + '</span>' +
        '</a>';
    }).join('');
  }

  function load() {
    document.getElementById('status').textContent = 'Loading Portal Watchlist…';
    fetch(buildUrl())
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (b) { throw new Error(b.error); }); })
      .then(function (d) { renderGrid(d.players || []); })
      .catch(function (e) { document.getElementById('status').textContent = e.message || 'Failed to load'; });
  }

  renderToolbar();
  load();
})();
