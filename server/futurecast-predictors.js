(function () {
  'use strict';
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderTable(predictors) {
    var status = document.getElementById('status');
    var wrap = document.getElementById('table-wrap');
    if (!predictors.length) { status.textContent = 'No predictor stats yet.'; wrap.innerHTML = ''; return; }
    status.textContent = '';
    wrap.innerHTML = '<table class="fc-leaderboard-table"><thead><tr><th>Predictor</th><th>Picks</th><th>Hits</th><th>Misses</th><th>Hit Rate</th></tr></thead><tbody>' +
      predictors.map(function (p) {
        var rate = p.hits + p.misses > 0 ? Math.round(p.hitRate * 100) + '%' : '—';
        return '<tr><td>' + esc(p.name) + '</td><td>' + p.picks + '</td><td>' + p.hits + '</td><td>' + p.misses + '</td><td>' + rate + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  document.getElementById('status').textContent = 'Loading predictor stats…';
  fetch(API + '/api/predictors/leaderboard')
    .then(function (r) { return r.ok ? r.json() : r.json().then(function (b) { throw new Error(b.error); }); })
    .then(function (d) { renderTable(d.predictors || []); })
    .catch(function (e) { document.getElementById('status').textContent = e.message || 'Failed'; });
})();
