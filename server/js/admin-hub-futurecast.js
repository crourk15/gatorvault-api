/**
 * Admin Hub — FutureCast targets + 2028 admin allowlist control.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function pushAct(entry) {
    if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
      global.GVAdminHub.pushActivity(entry);
    }
  }

  function pctLabel(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n > 0 && n <= 1) n = n * 100;
    return Math.round(n) + '%';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate;

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">FutureCast &amp; Allowlist</h2>'
      + '<p class="hub-dash-sub">See what Beat Desk seeds/promotes — manage 2028 admin allowlist (2027 Closing Class stays locked)</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-fc-to-desk">Beat Desk</button>'
      + '<button type="button" class="hub-btn" id="hub-fc-refresh">Refresh</button>'
      + '</div></div>'
      + '<div id="hub-fc-loading" class="hub-dash-loading">Loading FutureCast control…</div>'
      + '<div id="hub-fc-body" class="hidden"></div>'
      + '<p id="hub-fc-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-fc-loading');
    var body = document.getElementById('hub-fc-body');
    var msg = document.getElementById('hub-fc-msg');

    document.getElementById('hub-fc-refresh').addEventListener('click', load);
    document.getElementById('hub-fc-to-desk').addEventListener('click', function () {
      if (typeof onNavigate === 'function') onNavigate('#beat-desk/desk');
    });

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(data) {
      var c = data.counts || {};
      var adminRows = data.adminAllowlist2028 || [];
      var board = data.board2028Sample || [];
      var watch = data.earlyWatch || [];

      var adminHtml = adminRows.length
        ? adminRows.map(function (r) {
          return '<tr>'
            + '<td><strong style="color:#fff">' + esc(r.name) + '</strong>'
            + '<div class="hub-meta">' + esc(r.slug) + '</div></td>'
            + '<td>2028</td>'
            + '<td><button type="button" class="hub-btn secondary hub-fc-remove" data-slug="' + esc(r.slug) + '">Remove</button></td>'
            + '</tr>';
        }).join('')
        : '<tr><td colspan="3" class="hub-meta">No admin allowlist extras yet — Beat Desk can soft-add Florida-involved 2028 targets.</td></tr>';

      var boardHtml = board.length
        ? board.map(function (r) {
          return '<tr>'
            + '<td><strong style="color:#fff">' + esc(r.name) + '</strong>'
            + '<div class="hub-meta">' + esc(r.slug) + (r.pos ? ' · ' + esc(r.pos) : '') + '</div></td>'
            + '<td>' + esc(pctLabel(r.ufPct)) + '</td>'
            + '<td class="hub-meta">' + esc(r.source || 'board') + '</td>'
            + '</tr>';
        }).join('')
        : '<tr><td colspan="3" class="hub-meta">2028 board empty or unavailable.</td></tr>';

      var watchHtml = watch.length
        ? watch.map(function (r) {
          return '<tr>'
            + '<td><strong style="color:#fff">' + esc(r.name || r.slug) + '</strong>'
            + '<div class="hub-meta">' + esc(r.slug) + '</div></td>'
            + '<td>' + esc(r.classYear || '—') + '</td>'
            + '<td class="hub-meta">' + esc(r.source || 'watch') + '</td>'
            + '</tr>';
        }).join('')
        : '<tr><td colspan="3" class="hub-meta">No early-watch entries.</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-st-green"><h3>Locked 2027</h3><p class="hub-kpi">' + esc(c.locked2027 || 0) + '</p><p class="hub-meta">Closing Class — not expandable</p></section>'
        + '<section class="hub-card"><h3>Locked 2028 code</h3><p class="hub-kpi">' + esc(c.locked2028 || 0) + '</p><p class="hub-meta">Hunt list in code</p></section>'
        + '<section class="hub-card"><h3>Admin 2028 extras</h3><p class="hub-kpi">' + esc(c.admin2028 || 0) + '</p><p class="hub-meta">Soft-adds from desk / resolve</p></section>'
        + '<section class="hub-card"><h3>Board 2028</h3><p class="hub-kpi">' + esc(c.board2028 || 0) + '</p><p class="hub-meta">Target board rows · watch ' + esc(c.earlyWatch || 0) + '</p></section>'
        + '</div>'
        + '<p class="hub-meta" style="margin:12px 0">' + esc((data.notes && data.notes.deskFeed) || '') + '</p>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Add 2028 allowlist target</h3>'
        + '<div class="hub-btn-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end">'
        + '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8">Slug'
        + '<input id="hub-fc-slug" type="text" placeholder="ryan-peterson" style="min-width:180px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff"></label>'
        + '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8">Name'
        + '<input id="hub-fc-name" type="text" placeholder="Ryan Peterson" style="min-width:180px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff"></label>'
        + '<button type="button" class="hub-btn" id="hub-fc-add">Add to allowlist</button>'
        + '</div>'
        + '<p class="hub-meta" style="margin:8px 0 0">2027 Closing Class is hard-locked. Only 2028 extras are editable here.</p>'
        + '</div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Admin allowlist (2028 extras)</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>Class</th><th></th></tr></thead><tbody>'
        + adminHtml
        + '</tbody></table></div></div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>2028 target board (sample)</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>UF %</th><th>Source</th></tr></thead><tbody>'
        + boardHtml
        + '</tbody></table></div></div>'
        + '<div class="hub-card">'
        + '<h3>Early watchlist</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>Class</th><th>Source</th></tr></thead><tbody>'
        + watchHtml
        + '</tbody></table></div></div>';

      var addBtn = document.getElementById('hub-fc-add');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var slug = (document.getElementById('hub-fc-slug').value || '').trim();
          var name = (document.getElementById('hub-fc-name').value || '').trim();
          if (!slug || !name) {
            setMsg('Slug and name required.', true);
            return;
          }
          addBtn.disabled = true;
          apiPost('/api/admin/hub/allowlist/add', { slug: slug, name: name, classYear: 2028 })
            .then(function (j) {
              if (j.added === false) {
                setMsg(j.reason || 'Not added', true);
                return;
              }
              setMsg('Added ' + (j.slug || slug) + ' to 2028 allowlist.');
              pushAct({ status: 'success', message: 'Allowlist add: ' + slug, subsystem: 'futurecast' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Add failed', true); })
            .finally(function () { addBtn.disabled = false; });
        });
      }

      body.querySelectorAll('.hub-fc-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-slug');
          if (!slug) return;
          btn.disabled = true;
          apiPost('/api/admin/hub/allowlist/remove', { slug: slug, classYear: 2028 })
            .then(function (j) {
              setMsg(j.removed ? ('Removed ' + slug) : (j.reason || 'Not removed'));
              pushAct({ status: 'success', message: 'Allowlist remove: ' + slug, subsystem: 'futurecast' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Remove failed', true); })
            .finally(function () { btn.disabled = false; });
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      return apiGet('/api/admin/hub/futurecast')
        .then(function (data) {
          if (!data || data.ok === false) throw new Error((data && data.error) || 'Load failed');
          paint(data);
          loading.classList.add('hidden');
          body.classList.remove('hidden');
        })
        .catch(function (e) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML = '<p class="hub-meta err">' + esc(e.message || 'Failed to load FutureCast control') + '</p>';
          setMsg(e.message || 'Failed', true);
        });
    }

    load();
  }

  global.GVAdminFutureCast = { render: render };
})(window);
