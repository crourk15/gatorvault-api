/**
 * Admin Hub — in-shell Roster & Board (summary + full interactive board).
 * Replaces the recruiting-board.html iframe for daily editing.
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

  function boardRows(board) {
    var targets = [];
    if (Array.isArray(board)) targets = board;
    else if (board && Array.isArray(board.players)) targets = board.players;
    else if (board && Array.isArray(board.items)) targets = board.items;
    else if (board && board.board && Array.isArray(board.board)) targets = board.board;
    return targets;
  }

  function rosterRows(players) {
    return Array.isArray(players) ? players : (players && players.players) || [];
  }

  function renderSummary(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate || function () {};

    container.innerHTML =
      '<div class="hub-sum">' +
      '<div class="hub-dash-head">' +
      '<div><h2 class="hub-dash-title">Roster &amp; Board</h2>' +
      '<p class="hub-dash-sub">UF roster snapshot + recruiting board targets — edit in Full Board when needed.</p></div>' +
      '<div class="hub-btn-row">' +
      '<button type="button" class="hub-btn secondary" id="hub-board-refresh">Refresh</button>' +
      '<button type="button" class="hub-btn secondary" id="hub-board-grades">Vault Grades</button>' +
      '<button type="button" class="hub-btn secondary" id="hub-board-full">Open Full Board</button>' +
      '</div></div>' +
      '<div id="hub-board-loading" class="hub-dash-loading">Loading roster &amp; board…</div>' +
      '<div id="hub-board-body" class="hidden"></div>' +
      '<p id="hub-board-msg" class="hub-meta" style="margin-top:12px"></p>' +
      '</div>';

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
      msg.style.color = isErr ? '#fc5a55' : '';
    }

    function paint(players, board) {
      var roster = rosterRows(players);
      var targets = boardRows(board);
      var rosterHtml = roster.slice(0, 40).map(function (p) {
        return '<tr>' +
          '<td>' + esc(p.name || p.fullName || '—') + '</td>' +
          '<td>' + esc(p.position || p.pos || '—') + '</td>' +
          '<td>' + esc(p.classYear || p.year || p.class || '—') + '</td>' +
          '<td>' + esc(p.jersey != null ? '#' + p.jersey : (p.number != null ? '#' + p.number : '—')) + '</td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="4">No roster rows loaded</td></tr>';

      var boardHtml = targets.slice(0, 30).map(function (p) {
        return '<tr>' +
          '<td>' + esc(p.name || p.fullName || '—') + '</td>' +
          '<td>' + esc(p.position || p.pos || '—') + '</td>' +
          '<td>' + esc(p.classYear || p.year || '—') + '</td>' +
          '<td>' + esc(stars(p.stars || p.rating)) + '</td>' +
          '<td>' + esc(p.status || p.committedTo || p.priority || '—') + '</td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="5">No board targets loaded</td></tr>';

      body.innerHTML =
        '<div class="hub-kpi-row">' +
        '<div class="hub-kpi"><span class="hub-kpi-label">Roster</span><strong>' + roster.length + '</strong></div>' +
        '<div class="hub-kpi"><span class="hub-kpi-label">Board targets</span><strong>' + targets.length + '</strong></div>' +
        '</div>' +
        '<h3 class="hub-dash-h3" style="margin-top:1rem">Roster snapshot</h3>' +
        '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>' +
        '<th>Name</th><th>Pos</th><th>Class</th><th>#</th></tr></thead><tbody>' +
        rosterHtml + '</tbody></table></div>' +
        '<h3 class="hub-dash-h3" style="margin-top:1.25rem">Recruiting board</h3>' +
        '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>' +
        '<th>Name</th><th>Pos</th><th>Class</th><th>Stars</th><th>Status</th></tr></thead><tbody>' +
        boardHtml + '</tbody></table></div>';

      loading.classList.add('hidden');
      body.classList.remove('hidden');
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('Loading…');
      Promise.all([
        apiGet('/api/roster/players').catch(function () { return apiGet('/api/players'); }),
        apiGet('/api/recruiting/board').catch(function () { return { players: [] }; }),
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

  function renderFull(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};
    var year = 2027;
    var q = '';
    var rows = [];
    var selected = null;

    container.innerHTML =
      '<div class="hub-sum">' +
      '<div class="hub-dash-head">' +
      '<div><h2 class="hub-dash-title">Full Recruiting Board</h2>' +
      '<p class="hub-dash-sub">In-shell board editor — search, filter by class, update status/priority without the legacy iframe.</p></div>' +
      '<div class="hub-btn-row">' +
      '<button type="button" class="hub-btn secondary" id="hub-bf-summary">Summary</button>' +
      '<button type="button" class="hub-btn secondary" id="hub-bf-grades">Vault Grades</button>' +
      '<button type="button" class="hub-btn secondary" id="hub-bf-refresh">Refresh</button>' +
      '</div></div>' +
      '<div class="hub-btn-row" style="margin:12px 0;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="hub-btn secondary hub-bf-year" data-year="2026">2026</button>' +
      '<button type="button" class="hub-btn secondary hub-bf-year is-active" data-year="2027">2027</button>' +
      '<button type="button" class="hub-btn secondary hub-bf-year" data-year="2028">2028</button>' +
      '<input id="hub-bf-q" class="hub-input" type="search" placeholder="Search name / position…" style="min-width:220px;flex:1" />' +
      '</div>' +
      '<div id="hub-bf-loading" class="hub-dash-loading">Loading board…</div>' +
      '<div id="hub-bf-layout" class="hidden" style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr);gap:16px">' +
      '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>' +
      '<th>Name</th><th>Pos</th><th>Stars</th><th>Status</th><th>Priority</th></tr></thead>' +
      '<tbody id="hub-bf-tbody"></tbody></table></div>' +
      '<div id="hub-bf-editor" class="hub-card" style="padding:12px">' +
      '<h3 class="hub-dash-h3">Edit target</h3>' +
      '<p class="hub-meta" id="hub-bf-empty">Select a target to edit.</p>' +
      '<form id="hub-bf-form" class="hidden" style="display:grid;gap:8px">' +
      '<label>Name<br/><input class="hub-input" id="hub-bf-name" readonly /></label>' +
      '<label>Status<br/><input class="hub-input" id="hub-bf-status" /></label>' +
      '<label>Priority<br/><input class="hub-input" id="hub-bf-priority" /></label>' +
      '<label>Notes<br/><textarea class="hub-input" id="hub-bf-notes" rows="4"></textarea></label>' +
      '<button type="submit" class="hub-btn">Save changes</button>' +
      '<p class="hub-meta" id="hub-bf-form-msg"></p>' +
      '</form></div></div>' +
      '<p id="hub-bf-msg" class="hub-meta" style="margin-top:12px"></p>' +
      '</div>';

    var loading = document.getElementById('hub-bf-loading');
    var layout = document.getElementById('hub-bf-layout');
    var tbody = document.getElementById('hub-bf-tbody');
    var msg = document.getElementById('hub-bf-msg');
    var form = document.getElementById('hub-bf-form');
    var empty = document.getElementById('hub-bf-empty');
    var formMsg = document.getElementById('hub-bf-form-msg');

    document.getElementById('hub-bf-summary').addEventListener('click', function () {
      onNavigate('#team/board');
    });
    document.getElementById('hub-bf-grades').addEventListener('click', function () {
      onNavigate('#team/vault-grades');
    });
    document.getElementById('hub-bf-refresh').addEventListener('click', load);
    document.getElementById('hub-bf-q').addEventListener('input', function (ev) {
      q = String(ev.target.value || '').trim().toLowerCase();
      paintTable();
    });
    Array.prototype.forEach.call(container.querySelectorAll('.hub-bf-year'), function (btn) {
      btn.addEventListener('click', function () {
        year = Number(btn.getAttribute('data-year')) || 2027;
        Array.prototype.forEach.call(container.querySelectorAll('.hub-bf-year'), function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        load();
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!selected) return;
      var slug = selected.slug || selected.playerSlug || selected.id;
      if (!slug) {
        formMsg.textContent = 'Missing player slug';
        formMsg.style.color = '#fc5a55';
        return;
      }
      formMsg.textContent = 'Saving…';
      formMsg.style.color = '';
      var body = {
        status: document.getElementById('hub-bf-status').value,
        priority: document.getElementById('hub-bf-priority').value,
        notes: document.getElementById('hub-bf-notes').value,
      };
      Promise.resolve(apiPost('/api/recruiting/players/' + encodeURIComponent(slug), body))
        .then(function () {
          formMsg.textContent = 'Saved';
          selected.status = body.status;
          selected.priority = body.priority;
          selected.notes = body.notes;
          paintTable();
        })
        .catch(function (err) {
          formMsg.textContent = err && err.message ? err.message : 'Save failed';
          formMsg.style.color = '#fc5a55';
        });
    });

    function setMsg(text, isErr) {
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fc5a55' : '';
    }

    function selectRow(row) {
      selected = row;
      empty.classList.add('hidden');
      form.classList.remove('hidden');
      form.style.display = 'grid';
      document.getElementById('hub-bf-name').value = row.name || row.fullName || '';
      document.getElementById('hub-bf-status').value = row.status || row.committedTo || '';
      document.getElementById('hub-bf-priority').value = row.priority || '';
      document.getElementById('hub-bf-notes').value = row.notes || row.staffNotes || '';
      formMsg.textContent = '';
    }

    function paintTable() {
      var filtered = rows.filter(function (p) {
        if (!q) return true;
        var hay = [p.name, p.fullName, p.position, p.pos, p.status, p.priority]
          .map(function (x) { return String(x || '').toLowerCase(); })
          .join(' ');
        return hay.indexOf(q) !== -1;
      });
      tbody.innerHTML = filtered.map(function (p, idx) {
        var key = p.slug || p.playerSlug || p.id || String(idx);
        return '<tr data-key="' + esc(key) + '" style="cursor:pointer">' +
          '<td>' + esc(p.name || p.fullName || '—') + '</td>' +
          '<td>' + esc(p.position || p.pos || '—') + '</td>' +
          '<td>' + esc(stars(p.stars || p.rating)) + '</td>' +
          '<td>' + esc(p.status || p.committedTo || '—') + '</td>' +
          '<td>' + esc(p.priority || '—') + '</td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="5">No targets for this class.</td></tr>';

      Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-key]'), function (tr) {
        tr.addEventListener('click', function () {
          var key = tr.getAttribute('data-key');
          var row = filtered.find(function (p, idx) {
            return String(p.slug || p.playerSlug || p.id || idx) === key;
          });
          if (row) selectRow(row);
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      layout.classList.add('hidden');
      setMsg('Loading ' + year + ' board…');
      var path = '/api/recruiting/board?year=' + year;
      Promise.resolve(apiGet(path))
        .catch(function () { return apiGet('/api/recruiting/board'); })
        .then(function (board) {
          rows = boardRows(board);
          loading.classList.add('hidden');
          layout.classList.remove('hidden');
          layout.style.display = 'grid';
          paintTable();
          setMsg(rows.length + ' targets · class ' + year + ' · ' + new Date().toLocaleTimeString());
        })
        .catch(function (err) {
          loading.classList.add('hidden');
          layout.classList.remove('hidden');
          tbody.innerHTML = '<tr><td colspan="5">Could not load board.</td></tr>';
          setMsg(err && err.message ? err.message : 'Load failed', true);
        });
    }

    load();
  }

  global.GVAdminBoardSummary = { render: renderSummary };
  global.GVAdminBoardFull = { render: renderFull };
})(typeof window !== 'undefined' ? window : globalThis);
