/**
 * Beat Brief Desk — Charles daily loop:
 * Tap Open → Copy Brief → paste to Cursor/Copilot → post on X.
 */
(function (global) {
  var FRESH_MS = 48 * 60 * 60 * 1000;

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
    if (s.indexOf('fail') >= 0 || s === 'error' || s === 'red' || s === 'stale') return 'hub-st-red';
    if (s.indexOf('review') >= 0 || s === 'needs_you' || s === 'yellow' || s === 'pending') return 'hub-st-yellow';
    if (s === 'ready_to_compose' || s === 'draft_ready' || s === 'ok' || s === 'green') return 'hub-st-green';
    return 'hub-st-unknown';
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

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var selectedSlug = '';
    var lastBrief = null;
    var allItems = [];
    var showOlder = false;
    var pulseTimer = null;

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Beat Brief Desk</h2>'
      + '<p class="hub-dash-sub"><strong style="color:#fff">What to do:</strong> '
      + '1) Press <strong style="color:#fff">Open</strong> on a fresh beat · '
      + '2) Press <strong style="color:#fff">Copy Brief</strong> · '
      + '3) Paste into Cursor/Copilot · 4) Post on X</p></div>'
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
            + esc((err && err.message) || 'retrying…');
        });
    }

    function visibleItems() {
      if (showOlder) return allItems.slice();
      var fresh = allItems.filter(function (it) {
        return it.ageMs == null || it.ageMs <= FRESH_MS;
      });
      return fresh.length ? fresh : allItems.slice(0, 8);
    }

    function showPacketLoading(slug, name) {
      var panel = document.getElementById('hub-bd-brief');
      if (!panel) return;
      panel.innerHTML =
        '<h3>Player packet</h3>'
        + '<p class="hub-meta">Building brief for <strong style="color:#fff">'
        + esc(name || slug) + '</strong>…</p>'
        + '<p class="hub-dash-loading" style="margin-top:12px">Gathering beat + UF facts…</p>';
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    }

    function paintBrief(brief) {
      lastBrief = brief;
      var panel = document.getElementById('hub-bd-brief');
      if (!panel) return;
      var p = brief.player || {};
      var beat = brief.primaryBeat || {};
      var ageMs = beat.reportedAt ? (Date.now() - new Date(beat.reportedAt).getTime()) : null;
      var stale = ageMs != null && ageMs > FRESH_MS;

      panel.innerHTML =
        '<div class="hub-dash-hero" style="margin-bottom:12px">'
        + '<div><span class="hub-overall-label">Player packet</span>'
        + '<strong class="hub-overall-val">' + esc(brief.playerName || brief.slug) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">'
        + esc([p.position, p.classYear, p.school, p.state].filter(Boolean).join(' · ') || brief.slug)
        + (stale ? ' · <span class="hub-env-badge hub-st-yellow">STALE BEAT</span>' : '')
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-bd-copy">Copy Brief</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-bd-copy-draft">Copy draft only</button>'
        + '</div></div>'
        + (stale
          ? '<p class="hub-meta" style="color:#fbbf24;margin:0 0 12px">This beat is older than 48h. Still usable for a catch-up post, but prefer fresher rows when you can.</p>'
          : '')
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
        + '<pre id="hub-bd-paste" style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.45;max-height:280px;overflow:auto;background:#0b1220;padding:12px;border-radius:8px;color:#e2e8f0">'
        + esc(brief.pasteText || '')
        + '</pre></div>';

      document.getElementById('hub-bd-copy').addEventListener('click', function () {
        copyText(brief.pasteText || '')
          .then(function () { setMsg('Brief copied — paste into Cursor or Copilot now.'); })
          .catch(function () { setMsg('Copy failed — select the brief text manually.', true); });
      });
      document.getElementById('hub-bd-copy-draft').addEventListener('click', function () {
        var draft = (brief.draftSuggestion && brief.draftSuggestion.text) || '';
        if (!draft) {
          setMsg('No draft yet — Copy Brief and ask AI to write the post.', true);
          return;
        }
        copyText(draft)
          .then(function () { setMsg('Draft copied.'); })
          .catch(function () { setMsg('Copy failed.', true); });
      });

      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    }

    function openBrief(slug, name) {
      selectedSlug = slug;
      showPacketLoading(slug, name);
      setMsg('Building brief for ' + (name || slug) + '…');
      body.querySelectorAll('[data-bd-slug]').forEach(function (row) {
        row.classList.toggle('hub-ps-row--active', row.getAttribute('data-bd-slug') === slug);
      });

      return apiGet('/api/x/post-studio/brief/' + encodeURIComponent(slug))
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && brief.error) || 'Brief failed');
          paintBrief(brief);
          setMsg('Brief ready for ' + (brief.playerName || slug) + '. Press Copy Brief, then paste into Cursor.');
        })
        .catch(function (err) {
          var panel = document.getElementById('hub-bd-brief');
          if (panel) {
            panel.innerHTML =
              '<h3>Player packet</h3>'
              + '<p class="hub-meta" style="color:#fca5a5">' + esc((err && err.message) || 'Could not build brief.') + '</p>'
              + '<button type="button" class="hub-btn" id="hub-bd-retry-brief">Try again</button>';
            var btn = document.getElementById('hub-bd-retry-brief');
            if (btn) btn.addEventListener('click', function () { openBrief(slug, name); });
          }
          setMsg((err && err.message) || 'Could not build brief.', true);
        });
    }

    function copyBriefDirect(slug, name) {
      setMsg('Building + copying brief for ' + (name || slug) + '…');
      return apiGet('/api/x/post-studio/brief/' + encodeURIComponent(slug))
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && brief.error) || 'Brief failed');
          selectedSlug = slug;
          paintBrief(brief);
          return copyText(brief.pasteText || '').then(function () {
            setMsg('Brief copied for ' + (brief.playerName || slug) + ' — paste into Cursor/Copilot.');
          });
        })
        .catch(function (err) {
          setMsg((err && err.message) || 'Copy brief failed.', true);
        });
    }

    function paintInbox() {
      var items = visibleItems();
      var freshCount = allItems.filter(function (it) {
        return it.ageMs == null || it.ageMs <= FRESH_MS;
      }).length;
      var olderCount = allItems.length - freshCount;

      var rows = items.map(function (it) {
        var st = (it.status && it.status.label) || (it.status && it.status.status) || '—';
        var slug = it.slug || '';
        var stale = it.ageMs != null && it.ageMs > FRESH_MS;
        var name = it.playerName || slug || '—';
        return '<tr data-bd-slug="' + esc(slug) + '" class="hub-ps-row' + (slug === selectedSlug ? ' hub-ps-row--active' : '') + '">'
          + '<td><strong style="color:#fff">' + esc(name) + '</strong>'
          + '<div class="hub-meta" style="margin:2px 0 0">' + esc(slug) + '</div></td>'
          + '<td><span class="hub-env-badge ' + statusClass(stale ? 'stale' : ((it.status && it.status.status) || st)) + '">'
          + esc(stale ? 'STALE' : (typeof st === 'string' ? st : '—')) + '</span></td>'
          + '<td>' + esc(it.ageLabel || fmtTime(it.reportedAt)) + '</td>'
          + '<td>' + esc((it.beatText || '').slice(0, 90)) + '</td>'
          + '<td style="white-space:nowrap">'
          + '<button type="button" class="hub-btn sm" data-bd-open="' + esc(slug) + '" data-bd-name="' + esc(name) + '" style="min-height:36px;padding:8px 10px;margin-right:6px">Open</button>'
          + '<button type="button" class="hub-btn secondary sm" data-bd-copy="' + esc(slug) + '" data-bd-name="' + esc(name) + '" style="min-height:36px;padding:8px 10px">Copy Brief</button>'
          + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="5">No beat intel in this view.</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide">'
        + '<div class="hub-dash-head" style="margin-bottom:10px">'
        + '<div><h3 style="margin:0">Beat inbox <span class="hub-meta">(' + esc(items.length) + ' shown)</span></h3>'
        + '<p class="hub-meta" style="margin:6px 0 0">Fresh (&lt;48h): <strong style="color:#fff">' + esc(freshCount)
        + '</strong> · Older: <strong style="color:#fff">' + esc(olderCount) + '</strong></p></div>'
        + '<div class="hub-btn-row">'
        + '<button type="button" class="hub-btn secondary" id="hub-bd-toggle-age">'
        + (showOlder ? 'Hide older beats' : 'Show older beats') + '</button>'
        + '</div></div>'
        + '<div class="hub-table-wrap"><table class="hub-table" style="width:100%">'
        + '<thead><tr><th>Player</th><th>Status</th><th>Age</th><th>Beat</th><th>Action</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '</section>'
        + '<section class="hub-card hub-card-wide" id="hub-bd-brief">'
        + '<h3>Player packet</h3>'
        + '<p class="hub-meta" style="margin:0">Press <strong style="color:#fff">Open</strong> or <strong style="color:#fff">Copy Brief</strong> on a row above.</p>'
        + '</section>'
        + '</div>';

      document.getElementById('hub-bd-toggle-age').addEventListener('click', function () {
        showOlder = !showOlder;
        paintInbox();
      });

      body.querySelectorAll('[data-bd-open]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openBrief(btn.getAttribute('data-bd-open'), btn.getAttribute('data-bd-name'));
        });
      });
      body.querySelectorAll('[data-bd-copy]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyBriefDirect(btn.getAttribute('data-bd-copy'), btn.getAttribute('data-bd-name'));
        });
      });

      if (lastBrief && lastBrief.slug && selectedSlug === lastBrief.slug) {
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
          allItems = (inbox && inbox.items) || [];
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          paintInbox();
          var freshCount = allItems.filter(function (it) {
            return it.ageMs == null || it.ageMs <= FRESH_MS;
          }).length;
          setMsg(
            freshCount
              ? 'Inbox ready — ' + freshCount + ' fresh beat(s). Press Open or Copy Brief.'
              : 'No fresh beats (under 48h). Showing older — press Show older / Open for catch-up posts.'
          );
        })
        .catch(function (err) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML =
            '<div class="hub-card hub-card-wide hub-st-yellow">'
            + '<h3>Kitchen busy</h3>'
            + '<p class="hub-meta">' + esc((err && err.message) || 'API unavailable') + '</p>'
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
