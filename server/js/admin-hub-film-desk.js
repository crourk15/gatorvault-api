/**
 * Film Desk — Charles weekly loop:
 * Open game → locked card + writer intel seed → Copy Brief → Cursor Review draft.
 */
(function (global) {
  function esc(s) {
    var raw = s == null ? '' : String(s);
    if (typeof document !== 'undefined' && document.createElement) {
      var d = document.createElement('div');
      d.textContent = raw;
      return d.innerHTML;
    }
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('Nothing to copy'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function listHtml(items) {
    if (!items || !items.length) return '<p class="hub-meta" style="margin:0">—</p>';
    return '<ul style="margin:0;padding-left:18px;color:#e2e8f0;line-height:1.5">'
      + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('')
      + '</ul>';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate;
    var selectedId = '';
    var lastBrief = null;
    var inbox = { items: [], sources: [] };

    var notecardsHtml = (global.GVAdminNotecards && global.GVAdminNotecards.html)
      ? global.GVAdminNotecards.html('film', { onNavigate: onNavigate })
      : '';

    container.innerHTML =
      '<div class="hub-sum">'
      + notecardsHtml
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Film Desk</h2>'
      + '<p class="hub-dash-sub"><strong style="color:#fff">Quick path:</strong> '
      + 'Open a game → lock is the brief → Copy Brief → Cursor. Writers are a seed, not the Review.</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-fd-refresh">Refresh</button>'
      + '</div></div>'
      + '<div id="hub-fd-loading" class="hub-dash-loading">Opening Film Desk…</div>'
      + '<div id="hub-fd-body" class="hidden"></div>'
      + '<p id="hub-fd-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-fd-loading');
    var body = document.getElementById('hub-fd-body');
    var msg = document.getElementById('hub-fd-msg');

    if (global.GVAdminNotecards && typeof global.GVAdminNotecards.wire === 'function') {
      global.GVAdminNotecards.wire(container, { onNavigate: onNavigate });
    }

    document.getElementById('hub-fd-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paintBrief(brief) {
      lastBrief = brief;
      var panel = document.getElementById('hub-fd-brief');
      if (!panel) return;
      var g = brief.game || {};
      var card = brief.card || {};
      var seeds = brief.intelSeeds || [];
      var lockTone = card.locked ? 'hub-st-green' : 'hub-st-yellow';
      panel.innerHTML =
        '<div class="hub-dash-hero" style="margin-bottom:12px">'
        + '<div><span class="hub-overall-label">Game packet</span>'
        + '<strong class="hub-overall-val">Florida vs ' + esc(g.opp || brief.gameId) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">'
        + esc(g.date || '')
        + (g.finalUF != null ? ' · Florida ' + esc(g.finalUF) + '–' + esc(g.finalOpp) : '')
        + ' · <span class="hub-env-badge ' + lockTone + '">'
        + (card.locked ? 'CHARLES LOCKED' : 'UNLOCKED') + '</span>'
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-fd-copy">Copy Brief</button>'
        + '</div></div>'
        + '<div class="hub-card ' + lockTone + '" style="margin-bottom:12px">'
        + '<h3>What they ran</h3>'
        + listHtml(card.whatTheyRan)
        + '</div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>How it played</h3>'
        + listHtml(card.howItPlayed)
        + '</div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Do not say</h3>'
        + listHtml(card.doNotSay)
        + '</div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Writer intel seed <span class="hub-meta">(absorb — never name in the Review)</span></h3>'
        + (seeds.length
          ? '<ul style="margin:0;padding-left:18px;color:#e2e8f0;line-height:1.5">'
            + seeds.map(function (s) {
              return '<li>'
                + '<strong style="color:#fff">' + esc(s.sourceId || 'source') + '</strong>'
                + (s.title ? ' — ' + esc(s.title) : '')
                + (s.claim ? '<div class="hub-meta" style="margin:4px 0 0">' + esc(s.claim) + '</div>' : '')
                + (s.url ? '<div style="margin:4px 0 0"><a href="' + esc(s.url) + '" target="_blank" rel="noopener" style="color:#93c5fd">Open tape →</a></div>' : '')
                + '</li>';
            }).join('')
            + '</ul>'
          : '<p class="hub-meta" style="margin:0">No writer film seed yet. Add a YouTube/claim to the game card or Open after GNFP posts.</p>')
        + '</div>'
        + '<div class="hub-card">'
        + '<h3>Paste brief (for Cursor)</h3>'
        + '<pre id="hub-fd-paste" style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.45;max-height:280px;overflow:auto;background:#0f172a;padding:12px;border-radius:8px;color:#e2e8f0">'
        + esc(brief.pasteText || '')
        + '</pre></div>';

      document.getElementById('hub-fd-copy').addEventListener('click', function () {
        copyText(brief.pasteText || '')
          .then(function () { setMsg('Brief copied → paste into Cursor. Lock is the brief. Writers are a seed.'); })
          .catch(function () { setMsg('Copy failed — select the brief text manually.', true); });
      });
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { /* ignore */ }
    }

    function openBrief(gameId) {
      selectedId = gameId;
      var panel = document.getElementById('hub-fd-brief');
      if (panel) {
        panel.innerHTML = '<h3>Game packet</h3><p class="hub-dash-loading">Building Film Desk brief…</p>';
      }
      setMsg('Building brief for ' + gameId + '…');
      body.querySelectorAll('[data-fd-id]').forEach(function (row) {
        row.classList.toggle('hub-ps-row--active', row.getAttribute('data-fd-id') === gameId);
      });
      return apiGet('/api/admin/hub/film-desk/brief/' + encodeURIComponent(gameId), {
        retries: 1,
        timeoutMs: 20000
      })
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && (brief.message || brief.error)) || 'Brief failed');
          paintBrief(brief);
          setMsg('Brief ready for ' + (brief.game && brief.game.opp ? brief.game.opp : gameId) + '. Copy Brief → Cursor.');
        })
        .catch(function (err) {
          var text = (err && err.message) || 'Could not build brief.';
          if (panel) {
            panel.innerHTML = '<h3>Game packet</h3><p class="hub-meta" style="color:#fca5a5">' + esc(text) + '</p>'
              + '<button type="button" class="hub-btn" id="hub-fd-retry">Try again</button>';
            var btn = document.getElementById('hub-fd-retry');
            if (btn) btn.addEventListener('click', function () { openBrief(gameId); });
          }
          setMsg(text, true);
        });
    }

    function paintInbox() {
      var items = inbox.items || [];
      var rows = items.map(function (it) {
        var st = it.locked ? 'LOCKED' : (it.played ? 'PLAYED' : 'PREGAME');
        var tone = it.locked ? 'hub-st-green' : (it.played ? 'hub-st-yellow' : 'hub-st-unknown');
        return '<tr data-fd-id="' + esc(it.gameId) + '" class="hub-ps-row' + (it.gameId === selectedId ? ' hub-ps-row--active' : '') + '">'
          + '<td><strong style="color:#fff">' + esc(it.opponent) + '</strong>'
          + '<div class="hub-meta">' + esc(it.label || '') + '</div></td>'
          + '<td><span class="hub-env-badge ' + tone + '">' + esc(st) + '</span></td>'
          + '<td>' + esc(it.intelCount) + ' seed · ' + esc(it.tapeCount) + ' tape</td>'
          + '<td class="hub-bd-actions">'
          + '<button type="button" class="hub-btn sm" data-fd-open="' + esc(it.gameId) + '">Open</button>'
          + '<button type="button" class="hub-btn secondary sm" data-fd-copy="' + esc(it.gameId) + '">Copy Brief</button>'
          + '</td></tr>';
      }).join('') || '<tr><td colspan="4">No 2026 games on the slate.</td></tr>';

      var sourceLine = (inbox.sources || []).map(function (s) {
        return esc(s.name) + ' (' + esc(s.role) + ')';
      }).join(' · ');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide">'
        + '<h3 style="margin:0 0 8px">Game inbox</h3>'
        + '<p class="hub-meta" style="margin:0 0 10px">Sources: ' + (sourceLine || '—') + '</p>'
        + '<div class="hub-table-wrap"><table class="hub-table" style="width:100%">'
        + '<thead><tr><th>Game</th><th>Lock</th><th>Intel</th><th>Action</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '<p class="hub-meta" style="margin:10px 0 0">LOCKED = Charles card is the brief. Writer rows are seeds. Fan Review stays off until he says go.</p>'
        + '</section>'
        + '<section class="hub-card hub-card-wide" id="hub-fd-brief">'
        + '<h3>Vault packet</h3>'
        + '<p class="hub-meta" style="margin:0">Press <strong style="color:#fff">Open</strong> on FAU to see the Week 1 lock + Tengwall / GNFP seeds.</p>'
        + '</section>'
        + '</div>';

      body.querySelectorAll('[data-fd-open]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          openBrief(btn.getAttribute('data-fd-open'));
        });
      });
      body.querySelectorAll('[data-fd-copy]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var id = btn.getAttribute('data-fd-copy');
          openBrief(id).then(function () {
            if (lastBrief && lastBrief.pasteText) {
              return copyText(lastBrief.pasteText).then(function () {
                setMsg('Brief copied for ' + id + '.');
              });
            }
          });
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      return apiGet('/api/admin/hub/film-desk/inbox', { retries: 1, timeoutMs: 20000 })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.error) || 'Inbox failed');
          inbox = data;
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          paintInbox();
          setMsg((data.items || []).length + ' games on the Film Desk.');
        })
        .catch(function (err) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML = '<p class="hub-meta" style="color:#fca5a5">' + esc((err && err.message) || 'Film Desk failed to load.') + '</p>';
          setMsg((err && err.message) || 'Load failed.', true);
        });
    }

    load();
  }

  global.GVAdminFilmDesk = { render: render };
})(typeof window !== 'undefined' ? window : this);
