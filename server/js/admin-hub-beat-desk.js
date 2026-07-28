/**
 * Beat Brief Desk — Charles daily loop:
 * Inbox → open player → Copy Brief → paste to Cursor/Copilot → post on X.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function statusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s.indexOf('fail') >= 0 || s === 'error' || s === 'red') return 'hub-st-red';
    if (s.indexOf('review') >= 0 || s === 'needs_you' || s === 'yellow' || s === 'pending') return 'hub-st-yellow';
    if (s === 'ready_to_compose' || s === 'draft_ready' || s === 'ok' || s === 'green') return 'hub-st-green';
    return 'hub-st-unknown';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var selectedSlug = '';
    var lastBrief = null;
    var pulseTimer = null;

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Beat Brief Desk</h2>'
      + '<p class="hub-dash-sub">Beat drops → full player packet → Copy Brief → paste to Cursor/Copilot → post on X</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-bd-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-bd-ping">Check API</button>'
      + '</div></div>'
      + '<div id="hub-bd-pulse" class="hub-meta" style="margin:0 0 12px">Checking kitchen…</div>'
      + '<div id="hub-bd-loading" class="hub-dash-loading">Loading beat inbox…</div>'
      + '<div id="hub-bd-body" class="hidden"></div>'
      + '<p id="hub-bd-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-bd-loading');
    var body = document.getElementById('hub-bd-body');
    var msg = document.getElementById('hub-bd-msg');
    var pulse = document.getElementById('hub-bd-pulse');

    document.getElementById('hub-bd-refresh').addEventListener('click', load);
    document.getElementById('hub-bd-ping').addEventListener('click', updatePulse);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function updatePulse() {
      var started = Date.now();
      return apiGet('/api/ping')
        .then(function (j) {
          var ms = Date.now() - started;
          if (!pulse) return;
          pulse.innerHTML =
            '<span class="hub-env-badge hub-st-green">API up</span> · '
            + esc(ms + 'ms')
            + (j && j.ready === false ? ' · warming' : '');
        })
        .catch(function (err) {
          if (!pulse) return;
          pulse.innerHTML =
            '<span class="hub-env-badge hub-st-yellow">API busy</span> · '
            + esc((err && err.message) || 'retrying…')
            + ' — desk will keep trying quietly';
        });
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

    function paintBrief(brief) {
      lastBrief = brief;
      var panel = document.getElementById('hub-bd-brief');
      if (!panel) return;
      var p = brief.player || {};
      var beat = brief.primaryBeat || {};
      panel.innerHTML =
        '<div class="hub-dash-hero" style="margin-bottom:12px">'
        + '<div><span class="hub-overall-label">Player packet</span>'
        + '<strong class="hub-overall-val">' + esc(brief.playerName || brief.slug) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">'
        + esc([p.position, p.classYear, p.school, p.state].filter(Boolean).join(' · ') || brief.slug)
        + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0">UF: <strong style="color:#fff">'
        + esc(p.ufProbability != null ? String(p.ufProbability) : '—')
        + '</strong>'
        + (p.stars != null ? ' · ' + esc(p.stars) + '★' : '')
        + (p.natlRank != null ? ' · Nat #' + esc(p.natlRank) : '')
        + '</p>'
        + '<p class="hub-meta" style="margin:6px 0 0">Beats on file: <strong style="color:#fff">'
        + esc(brief.beatCount || 0) + '</strong>'
        + (p.rivals && p.rivals.length ? ' · Rivals: ' + esc(p.rivals.slice(0, 4).join(', ')) : '')
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-bd-copy">Copy Brief</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-bd-copy-draft">Copy draft only</button>'
        + '</div></div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Latest beat</h3>'
        + '<p class="hub-meta" style="margin:0 0 8px">' + esc(fmtTime(beat.reportedAt))
        + (beat.source ? ' · ' + esc(beat.source) : '') + '</p>'
        + '<p style="margin:0;white-space:pre-wrap;line-height:1.5;color:#e2e8f0">'
        + esc(beat.text || 'No beat text.') + '</p>'
        + (beat.articleUrl
          ? '<p style="margin:10px 0 0"><a href="' + esc(beat.articleUrl) + '" target="_blank" rel="noopener" style="color:#93c5fd">Open source →</a></p>'
          : '')
        + '</div>'
        + '<div class="hub-card">'
        + '<h3>Paste brief (for Cursor / Copilot)</h3>'
        + '<pre id="hub-bd-paste" style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.45;max-height:320px;overflow:auto;background:#0b1220;padding:12px;border-radius:8px;color:#e2e8f0">'
        + esc(brief.pasteText || '')
        + '</pre></div>';

      document.getElementById('hub-bd-copy').addEventListener('click', function () {
        copyText(brief.pasteText || '')
          .then(function () { setMsg('Brief copied — paste into Cursor or Copilot.'); })
          .catch(function () { setMsg('Copy failed — select the brief text manually.', true); });
      });
      document.getElementById('hub-bd-copy-draft').addEventListener('click', function () {
        var draft = (brief.draftSuggestion && brief.draftSuggestion.text) || '';
        if (!draft) {
          setMsg('No draft suggestion yet — Copy Brief and ask AI to write the post.', true);
          return;
        }
        copyText(draft)
          .then(function () { setMsg('Draft copied.'); })
          .catch(function () { setMsg('Copy failed.', true); });
      });
    }

    function openBrief(slug) {
      selectedSlug = slug;
      setMsg('Building brief for ' + slug + '…');
      return apiGet('/api/x/post-studio/brief/' + encodeURIComponent(slug))
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && brief.error) || 'Brief failed');
          paintBrief(brief);
          setMsg('Brief ready for ' + (brief.playerName || slug) + '.');
          body.querySelectorAll('[data-bd-slug]').forEach(function (row) {
            row.classList.toggle('hub-ps-row--active', row.getAttribute('data-bd-slug') === slug);
          });
        })
        .catch(function (err) {
          setMsg((err && err.message) || 'Could not build brief.', true);
        });
    }

    function paintInbox(inbox) {
      var items = (inbox && inbox.items) || [];
      var rows = items.slice(0, 40).map(function (it) {
        var st = (it.status && it.status.label) || (it.status && it.status.status) || '—';
        var slug = it.slug || '';
        return '<tr data-bd-slug="' + esc(slug) + '" class="hub-ps-row' + (slug === selectedSlug ? ' hub-ps-row--active' : '') + '" style="cursor:pointer">'
          + '<td><strong style="color:#fff">' + esc(it.playerName || slug || '—') + '</strong>'
          + '<div class="hub-meta" style="margin:2px 0 0">' + esc(slug) + '</div></td>'
          + '<td><span class="hub-env-badge ' + statusClass((it.status && it.status.status) || st) + '">'
          + esc(typeof st === 'string' ? st : '—') + '</span></td>'
          + '<td>' + esc(it.ageLabel || fmtTime(it.reportedAt)) + '</td>'
          + '<td>' + esc((it.beatText || '').slice(0, 110)) + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">No beat intel in inbox yet — wait for the next beat-writer run.</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide">'
        + '<h3>Beat inbox <span class="hub-meta">(' + esc(items.length) + ')</span></h3>'
        + '<p class="hub-meta" style="margin:0 0 10px">Tap a row → Copy Brief → paste to AI → post on X</p>'
        + '<div style="overflow:auto"><table class="hub-table" style="width:100%">'
        + '<thead><tr><th>Player</th><th>Status</th><th>Age</th><th>Beat</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</section>'
        + '<section class="hub-card hub-card-wide" id="hub-bd-brief">'
        + '<h3>Player packet</h3>'
        + '<p class="hub-meta" style="margin:0">Select a beat above to build the full UF packet.</p>'
        + '</section>'
        + '</div>';

      body.querySelectorAll('[data-bd-slug]').forEach(function (row) {
        row.addEventListener('click', function () {
          var slug = row.getAttribute('data-bd-slug');
          if (slug) openBrief(slug);
        });
      });

      if (selectedSlug) {
        openBrief(selectedSlug);
      } else if (lastBrief && lastBrief.slug) {
        paintBrief(lastBrief);
      }
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      updatePulse();
      return apiGet('/api/x/post-studio/inbox?limit=40')
        .then(function (inbox) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          paintInbox(inbox || { items: [] });
          setMsg('Inbox loaded · ' + (((inbox && inbox.items) || []).length) + ' beat rows');
        })
        .catch(function (err) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML =
            '<div class="hub-card hub-card-wide hub-st-yellow">'
            + '<h3>Kitchen busy</h3>'
            + '<p class="hub-meta">' + esc((err && err.message) || 'API unavailable') + '</p>'
            + '<p class="hub-meta">This is not the app — wait a few seconds and hit Refresh. No Codemagic needed.</p>'
            + '<button type="button" class="hub-btn" id="hub-bd-retry">Retry</button>'
            + '</div>';
          var retry = document.getElementById('hub-bd-retry');
          if (retry) retry.addEventListener('click', load);
          setMsg((err && err.message) || 'Could not load inbox.', true);
        });
    }

    load();
    if (pulseTimer) clearInterval(pulseTimer);
    pulseTimer = setInterval(updatePulse, 60000);
  }

  global.GVAdminBeatDesk = { render: render };
})(typeof window !== 'undefined' ? window : global);
