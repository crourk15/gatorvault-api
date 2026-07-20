/**
 * Admin Hub — in-shell Roster & Board summary (daily path without full recruiting-board iframe).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function stars(n) {
    var v = Number(n) || 0;
    if (v <= 0) return '—';
    return String(Math.round(v * 10) / 10) + '★';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Roster &amp; Board</h2>'
      + '<p class="hub-dash-sub">UF roster snapshot + recruiting board targets — edit in Full Board when needed</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-board-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-board-grades">Vault Grades</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-board-full">Full Board (legacy)</button>'
      + '</div></div>'
      + '<div id="hub-board-loading" class="hub-dash-loading">Loading roster &amp; board…</div>'
      + '<div id="hub-board-body" class="hidden"></div>'
      + '<p id="hub-board-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-board-loading');
    var body = document.getElementById('hub-board-body');
    var msg = document.getElementById('hub-board-msg');

    document.getElementById('hub-board-full').addEventListener('click', function () {
      onNavigate('#team/board-full');
    });
    document.getElementById('hub-board-grades').addEventListener('click', function () {
      onNavigate('#team/vault-grades');
    });
    document.getElementById('hub-board-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(players, board) {
      var roster = Array.isArray(players) ? players : (players && players.players) || [];
      var targets = [];
      if (Array.isArray(board)) targets = board;
      else if (board && Array.isArray(board.players)) targets = board.players;
      else if (board && Array.isArray(board.items)) targets = board.items;
      else if (board && board.board && Array.isArray(board.board)) targets = board.board;

      var rosterHtml = roster.slice(0, 40).map(function (p) {
        return '<tr>'
          + '<td>' + esc(p.name || p.fullName || '—') + '</td>'
          + '<td>' + esc(p.position || p.pos || '—') + '</td>'
          + '<td>' + esc(p.classYear || p.year || p.class || '—') + '</td>'
          + '<td>' + esc(p.jersey != null ? '#' + p.jersey : (p.number != null ? '#' + p.number : '—')) + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">No roster rows loaded</td></tr>';

      var boardHtml = targets.slice(0, 30).map(function (p) {
        return '<tr>'
          + '<td>' + esc(p.name || p.fullName || '—') + '</td>'
          + '<td>' + esc(p.position || p.pos || '—') + '</td>'
          + '<td>' + esc(p.classYear || p.year || '—') + '</td>'
          + '<td>' + esc(stars(p.stars || p.rating)) + '</td>'
          + '<td>' + esc(p.status || p.committedTo || p.priority || '—') + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="5">No board targets loaded</td></tr>';

      body.innerHTML =
        '<div class="hub-kpi-row">'
        + '<div class="hub-kpi"><span class="hub-kpi-label">Roster</span><strong>' + roster.length + '</strong></div>'
        + '<div class="hub-kpi"><span class="hub-kpi-label">Board targets</span><strong>' + targets.length + '</strong></div>'
        + '</div>'
        + '<h3 class="hub-dash-h3" style="margin-top:1rem">Roster snapshot</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>'
        + '<th>Name</th><th>Pos</th><th>Class</th><th>#</th></tr></thead><tbody>'
        + rosterHtml + '</tbody></table></div>'
        + '<h3 class="hub-dash-h3" style="margin-top:1.25rem">Recruiting board</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>'
        + '<th>Name</th><th>Pos</th><th>Class</th><th>Stars</th><th>Status</th></tr></thead><tbody>'
        + boardHtml + '</tbody></table></div>';
      loading.classList.add('hidden');
      body.classList.remove('hidden');
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('Loading…');
      Promise.all([
        apiGet('/api/roster/players').catch(function () { return apiGet('/api/players'); }),
        apiGet('/api/recruiting/board').catch(function () { return { players: [] }; })
      ]).then(function (results) {
        paint(results[0], results[1]);
        setMsg('Updated ' + new Date().toLocaleTimeString());
      }).catch(function (err) {
        loading.classList.add('hidden');
        body.classList.remove('hidden');
        body.innerHTML = '<p class="hub-meta">Could not load roster/board.</p>';
        setMsg(err && err.message ? err.message : 'Load failed', true);
      });
    }

    load();
  }

  global.GVAdminBoardSummary = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
