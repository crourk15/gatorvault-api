(function () {
  'use strict';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
  var POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];
  var CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
  var state = { classYear: 2026, position: '', tier: '', sort: 'ufFitScore', minScore: '' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fmtDelta(d) { return d > 0 ? '+' + d : String(d); }

  function buildUrl() {
    var p = new URLSearchParams();
    p.set('class_year', String(state.classYear));
    if (state.position) p.set('position', state.position);
    if (state.tier) p.set('tier', state.tier);
    if (state.sort) p.set('sort', state.sort);
    if (state.minScore !== '') p.set('minScore', String(state.minScore));
    p.set('limit', '100');
    return API + '/api/uf-fit/watchlist?' + p.toString();
  }

  function renderToolbar() {
    document.getElementById('toolbar').innerHTML =
      '<label>Class<select id="f-class">' + CLASS_YEARS.map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select></label>' +
      '<label>Position<select id="f-pos">' + POSITIONS.map(function (p) { return '<option value="' + p + '">' + (p || 'All') + '</option>'; }).join('') + '</select></label>' +
      '<label>Tier<select id="f-tier"><option value="">All</option><option value="elite">Elite</option><option value="strong">Strong</option><option value="moderate">Moderate</option><option value="low">Low</option></select></label>' +
      '<label>Sort<select id="f-sort"><option value="ufFitScore">UF Fit Score</option><option value="fitDelta">Fit Delta</option><option value="fitVolatility">Volatility</option></select></label>' +
      '<label>Min<select id="f-min"><option value="">Any</option><option value="50">50+</option><option value="70">70+</option><option value="85">85+</option></select></label>';
    document.getElementById('f-class').value = String(state.classYear);
    document.getElementById('f-sort').value = state.sort;
    ['f-class', 'f-pos', 'f-tier', 'f-sort', 'f-min'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function (e) {
        if (id === 'f-class') state.classYear = Number(e.target.value);
        if (id === 'f-pos') state.position = e.target.value;
        if (id === 'f-tier') state.tier = e.target.value;
        if (id === 'f-sort') state.sort = e.target.value;
        if (id === 'f-min') state.minScore = e.target.value;
        load();
      });
    });
  }

  function renderGrid(players) {
    var status = document.getElementById('status');
    var grid = document.getElementById('grid');
    if (!players.length) { status.textContent = 'No players match these filters.'; grid.innerHTML = ''; return; }
    status.textContent = '';
    grid.innerHTML = players.map(function (p) {
      var deltaCls = p.fitDelta >= 0 ? 'fc-uf-fit-delta--up' : 'fc-uf-fit-delta--down';
      return '<a class="fc-uf-fit-card" href="/futurecast/player/' + encodeURIComponent(p.slug) + '?tab=uf-fit">' +
        '<span style="color:#fa4616;font-size:0.75rem;font-weight:700">#' + p.rank + '</span>' +
        '<h3 class="fc-uf-fit-card__name">' + esc(p.fullName) + '</h3>' +
        '<p style="color:#94a3b8;font-size:0.8125rem">' + esc(p.position) + ' · ' + p.classYear + '</p>' +
        '<span class="fc-fit-badge fc-fit-badge--' + p.fitTier + '">' + p.fitTier + ' · ' + p.ufFitScore + '</span> ' +
        '<span class="' + deltaCls + '">Δ ' + fmtDelta(p.fitDelta) + '</span>' +
        '</a>';
    }).join('');
  }

  function load() {
    document.getElementById('status').textContent = 'Loading UF Fit Watchlist…';
    fetch(buildUrl()).then(function (r) { return r.ok ? r.json() : r.json().then(function (b) { throw new Error(b.error); }); })
      .then(function (d) { renderGrid(d.players || []); })
      .catch(function (e) { document.getElementById('status').textContent = e.message || 'Failed'; });
  }

  renderToolbar();
  load();
})();
