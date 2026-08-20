/**
 * Beat Brief Desk — Charles daily loop:
 * Tap Open → Copy Brief → paste to Cursor/Copilot → post on X.
 */
(function (global) {
  var FRESH_MS = 24 * 60 * 60 * 1000;
  var INBOX_CACHE_KEY = 'gv:beat-desk:inbox:v1';
  var AUTO_RETRY_MS = 8000;
  var MAX_AUTO_RETRIES = 4;

  function esc(s) {
    var raw = s == null ? '' : String(s);
    if (typeof document !== 'undefined' && document.createElement) {
      var d = document.createElement('div');
      d.textContent = raw;
      return d.innerHTML;
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Clean TOPIC / PLAYER label — no shouty ALL CAPS, no raw-slug titles. */
  function formatTopicLabel(name, slug, kind) {
    var raw = String(name || '').trim();
    var s = String(slug || '').trim().toLowerCase();
    var k = String(kind || 'recruit').toLowerCase();
    if (k === 'team' || k === 'program' || k === 'roster') {
      return raw || prettySlug(s) || '—';
    }
    if (raw && raw.length > 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) {
      raw = titleCaseWords(raw.toLowerCase());
    }
    if (!raw || raw === s || looksLikeSlug(raw)) {
      raw = prettySlug(s);
    }
    return raw || s || '—';
  }

  function looksLikeSlug(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(String(value || '').trim());
  }

  function titleCaseWords(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(function (w) {
        if (/^(wr|qb|rb|te|ol|dl|lb|cb|ath|ot|edge|iol|s|de|dt|og|c)$/i.test(w)) {
          return w.toUpperCase();
        }
        if (/^(jr|sr|ii|iii|iv)$/i.test(w)) {
          return w.toUpperCase().replace('JR', 'Jr').replace('SR', 'Sr');
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }

  function prettySlug(slug) {
    if (!slug) return '';
    return titleCaseWords(String(slug).replace(/-/g, ' '));
  }

  function topicKindMeta(kind) {
    var k = String(kind || 'recruit').toLowerCase();
    if (k === 'program') return { key: 'program', label: 'PROGRAM' };
    if (k === 'roster') return { key: 'roster', label: 'ROSTER' };
    if (k === 'team') return { key: 'team', label: 'TEAM' };
    return null;
  }

  function topicCellHtml(name, slug, kind) {
    var meta = topicKindMeta(kind);
    var label = formatTopicLabel(name, slug, kind);
    var kindHtml = meta
      ? '<span class="hub-bd-topic__kind hub-bd-topic__kind--' + esc(meta.key) + '">' + esc(meta.label) + '</span>'
      : '';
    return '<td class="hub-bd-topic">'
      + '<div class="hub-bd-topic__main">'
      + '<span class="hub-bd-topic__name">' + esc(label) + '</span>'
      + kindHtml
      + '</div>'
      + (slug
        ? '<div class="hub-bd-topic__slug" title="' + esc(slug) + '">' + esc(slug) + '</div>'
        : '')
      + '</td>';
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function statusClass(status) {
    var s = String(status || '').toLowerCase();
    // STALE = old beat (warning), not a broken system — keep it yellow.
    if (s === 'stale') return 'hub-st-yellow';
    if (s.indexOf('fail') >= 0 || s === 'error' || s === 'red') return 'hub-st-red';
    if (s.indexOf('review') >= 0 || s === 'needs_you' || s === 'yellow' || s === 'pending') return 'hub-st-yellow';
    if (s === 'ready_to_compose' || s === 'draft_ready' || s === 'ok' || s === 'green' || s === 'live') return 'hub-st-green';
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

  function projectionCompCardHtml(research, player) {
    var bd = (research && research.breakdown) || {};
    var projection = String((bd && bd.projection) || (player && player.projection) || '').trim();
    var comparison = String(
      (bd && bd.comparison) || (player && (player.playerComp || player.comparison)) || ''
    ).trim();
    var scheme = String((bd && bd.schemeFit) || (player && player.schemeFit) || '').trim();
    if (!projection && !comparison) {
      return '<div class="hub-card hub-st-yellow" style="margin-bottom:12px">'
        + '<h3>Projection / Comp</h3>'
        + '<p class="hub-meta" style="margin:0">None on file yet in War Room — Copy Brief still <strong style="color:#fff">requires</strong> both. Cursor must draft a matched-band projection + comp from tape + board.</p>'
        + '<p class="hub-meta" style="margin:8px 0 0">Standard: contribution path (when / role / ceiling) + GatorVault comp with <strong style="color:#fff">body size first</strong> (height ~1–2"), then win traits. 6-5 ≠ 6-1. Also deliver a HEADER leap.</p>'
        + '</div>';
    }
    return '<div class="hub-card hub-st-green" style="margin-bottom:12px">'
      + '<h3>Projection / Comp</h3>'
      + (projection
        ? '<p style="margin:0 0 8px;color:#e2e8f0;line-height:1.45"><strong>Projection:</strong> ' + esc(projection) + '</p>'
        : '<p class="hub-meta" style="margin:0 0 8px">Projection: (none on file — agent must draft from tape + board)</p>')
      + (comparison
        ? '<p style="margin:0 0 8px;color:#e2e8f0;line-height:1.45"><strong>GatorVault comp:</strong> ' + esc(comparison) + '</p>'
        : '<p class="hub-meta" style="margin:0 0 8px">GatorVault comp: (none on file — agent must draft size-matched body + traits)</p>')
      + (scheme
        ? '<p class="hub-meta" style="margin:0 0 8px">Scheme fit: ' + esc(scheme) + '</p>'
        : '')
      + '<p class="hub-meta" style="margin:0">Always required in the X post (plus HEADER). Comp must clear the size filter. Confirm before treating as live FutureCast profile copy.</p>'
      + '</div>';
  }

  function filmTraitsCardHtml(film) {
    var hasTraits = !!(film && film.traits && film.traits.length);
    var hasSources = !!(film && film.sources && film.sources.length);
    if (!film || (!hasTraits && !hasSources)) {
      return '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Film / highlights</h3>'
        + '<p class="hub-meta" style="margin:0">No On3/Hudl highlight link yet. Open again to auto-pull from On3 — Copy Brief will include the LINK for Cursor to review.</p>'
        + '</div>';
    }
    var traits = (film.traits || []).slice(0, 6).map(function (t) {
      return '<li style="margin:0 0 4px">' + esc(t) + '</li>';
    }).join('');
    var src = (film.sources && film.sources[0]) || null;
    var tone = hasSources ? 'hub-st-green' : 'hub-st-yellow';
    return '<div class="hub-card ' + tone + '" style="margin-bottom:12px">'
      + '<h3>Film / highlights</h3>'
      + (src
        ? '<p class="hub-meta" style="margin:0 0 8px">'
          + esc(src.label || src.type || 'Highlight')
          + (src.url
            ? ' · <a href="' + esc(src.url) + '" target="_blank" rel="noopener" style="color:#93c5fd">Open tape →</a>'
            : '')
          + (hasSources ? ' · <span class="hub-env-badge hub-st-green">LINK READY</span>' : '')
          + '</p>'
        : '')
      + (traits
        ? '<ul style="margin:0;padding-left:18px;color:#e2e8f0;line-height:1.45">' + traits + '</ul>'
        : '<p class="hub-meta" style="margin:0">Highlight LINK is in Copy Brief. Paste into Cursor — the agent reviews the tape, then writes the post.</p>')
      + (film.vaultFilmAngle
        ? '<p style="margin:10px 0 0;color:#cbd5e1;line-height:1.45">' + esc(film.vaultFilmAngle) + '</p>'
        : '')
      + '<p class="hub-meta" style="margin:10px 0 0">Included in <strong style="color:#fff">Copy Brief</strong> — use the tape in the post; don\'t announce the edge.</p>'
      + '</div>';
  }

  function futurecastCardHtml(fc) {
    if (!fc) {
      return '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>FutureCast feed</h3>'
        + '<p class="hub-meta" style="margin:0">No feed result on this Open. Open <button type="button" class="hub-btn secondary" id="hub-bd-to-fc" style="margin-left:8px">Targets &amp; Allowlist</button></p>'
        + '</div>';
    }
    if (fc.ok === false) {
      return '<div class="hub-card hub-st-yellow" style="margin-bottom:12px">'
        + '<h3>FutureCast feed</h3>'
        + '<p class="hub-meta" style="margin:0">' + esc(fc.error || fc.reason || 'Skipped') + '</p>'
        + '<p style="margin:10px 0 0"><button type="button" class="hub-btn secondary" id="hub-bd-to-fc">Open Targets &amp; Allowlist</button></p>'
        + '</div>';
    }
    var action = fc.isNew ? 'Seeded new target' : fc.promoted ? 'Promoted to board' : 'Refreshed board fields';
    var pct = fc.decision && fc.decision.pct != null ? (' · UF targeting ' + fc.decision.pct + '%') : '';
    var allow = fc.allowlist && fc.allowlist.added ? ' · allowlist +1' : '';
    return '<div class="hub-card hub-st-green" style="margin-bottom:12px">'
      + '<h3>FutureCast feed</h3>'
      + '<p style="margin:0;color:#e2e8f0"><strong>' + esc(action) + '</strong>' + esc(pct + allow) + '</p>'
      + (fc.decision && fc.decision.source
        ? '<p class="hub-meta" style="margin:6px 0 0">Source: ' + esc(fc.decision.source) + (fc.decision.rivalsLocked ? ' · Rivals PM locked' : '') + '</p>'
        : '')
      + '<p style="margin:10px 0 0"><button type="button" class="hub-btn secondary" id="hub-bd-to-fc">Inspect Targets &amp; Allowlist</button></p>'
      + '</div>';
  }


  function readInboxCache() {
    try {
      var raw = sessionStorage.getItem(INBOX_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeInboxCache(items) {
    try {
      sessionStorage.setItem(
        INBOX_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), items: items || [] })
      );
    } catch (e) { /* ignore */ }
  }

  function wakeLabel(info) {
    if (!info) return 'Connecting…';
    if (info.error) return info.error.message || 'Waking kitchen…';
    return 'Waking kitchen (' + ((info.attempt || 0) + 1) + '/' + (info.maxAttempts || '?') + ')…';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiBase = ctx.apiBase || (global.location && global.location.origin) || '';
    var onNavigate = ctx.onNavigate;
    var selectedSlug = '';
    var lastBrief = null;
    var allItems = [];
    var showOlder = false;
    var pulseTimer = null;

    var notecardsHtml = (global.GVAdminNotecards && global.GVAdminNotecards.html)
      ? global.GVAdminNotecards.html('desk', { onNavigate: onNavigate })
      : '';

    container.innerHTML =
      '<div class="hub-sum">'
      + notecardsHtml
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Beat Brief Desk</h2>'
      + '<p class="hub-dash-sub"><strong style="color:#fff">Quick path:</strong> '
      + 'Open → Copy Brief → Cursor → X. Notecards above explain every button.</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-bd-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-bd-ping">Check API</button>'
      + '</div></div>'
      + '<div id="hub-bd-pulse" class="hub-meta" style="margin:0 0 12px">Connecting to kitchen…</div>'
      + '<div id="hub-bd-loading" class="hub-dash-loading">Opening Beat Desk…</div>'
      + '<div id="hub-bd-body" class="hidden"></div>'
      + '<p id="hub-bd-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-bd-loading');
    var body = document.getElementById('hub-bd-body');
    var msg = document.getElementById('hub-bd-msg');
    var pulse = document.getElementById('hub-bd-pulse');

    if (global.GVAdminNotecards && typeof global.GVAdminNotecards.wire === 'function') {
      global.GVAdminNotecards.wire(container, { onNavigate: onNavigate });
    }

    document.getElementById('hub-bd-refresh').addEventListener('click', load);
    document.getElementById('hub-bd-ping').addEventListener('click', updatePulse);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function updatePulse(opts) {
      opts = opts || {};
      var started = Date.now();
      if (pulse && opts.quiet) {
        pulse.innerHTML = '<span class="hub-env-badge hub-st-yellow">Waking</span> · connecting…';
      }
      var fetchApi = global.GVAdminApiFetch;
      var ping = apiGet('/api/ping', { skipWake: true, retries: opts.retries != null ? opts.retries : 2 });
      // Prefer shared wake latch when available so ping storms collapse.
      if (!opts.skipEnsure && fetchApi && fetchApi.ensureAwake) {
        ping = fetchApi.ensureAwake(apiBase, {
          onAttempt: function (info) {
            if (!pulse) return;
            pulse.innerHTML =
              '<span class="hub-env-badge hub-st-yellow">Waking</span> · '
              + esc(wakeLabel(info));
          }
        }).then(function () {
          return apiGet('/api/ping', { skipWake: true, retries: 1 });
        });
      }
      return ping
        .then(function (j) {
          var ms = Date.now() - started;
          if (!pulse) return j;
          pulse.innerHTML =
            '<span class="hub-env-badge hub-st-green">Kitchen ready</span> · '
            + esc(ms + 'ms')
            + (j && j.ready === false ? ' · still warming' : '');
          return j;
        })
        .catch(function (err) {
          if (!pulse) return null;
          pulse.innerHTML =
            '<span class="hub-env-badge hub-st-yellow">Waking</span> · '
            + esc((err && err.message) || 'retrying…');
          return null;
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
        + '<p class="hub-dash-loading" style="margin-top:12px">Researching player + why UF + vault angle…</p>';
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    }

    function paintBrief(brief) {
      lastBrief = brief;
      var panel = document.getElementById('hub-bd-brief');
      if (!panel) return;
      var p = brief.player || {};
      var beat = brief.primaryBeat || {};
      var research = brief.research || {};
      var ageMs = beat.reportedAt ? (Date.now() - new Date(beat.reportedAt).getTime()) : null;
      var stale = ageMs != null && ageMs > FRESH_MS;

      panel.innerHTML =
        '<div class="hub-dash-hero" style="margin-bottom:12px">'
        + '<div><span class="hub-overall-label">Player packet</span>'
        + '<strong class="hub-overall-val">' + esc(brief.playerName || brief.slug) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">'
        + esc([p.position, p.classYear, p.school, p.state].filter(Boolean).join(' · ') || brief.slug)
        + (research.ufPosition ? ' · <span style="color:#93c5fd">UF: ' + esc(research.ufPosition) + '</span>' : '')
        + (stale ? ' · <span class="hub-env-badge hub-st-yellow">STALE BEAT</span>' : '')
        + (beat.liveBeat ? ' · <span class="hub-env-badge hub-st-green">LIVE BEAT</span>' : '')
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-bd-copy">Copy Brief</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-bd-copy-draft">Copy draft only</button>'
        + '</div></div>'
        + (stale
          ? '<p class="hub-meta" style="color:#fbbf24;margin:0 0 12px">This beat is older than 24h. Still usable for a catch-up post, but prefer fresher rows when you can.</p>'
          : '')
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Why Florida</h3>'
        + '<p style="margin:0;white-space:pre-wrap;line-height:1.5;color:#e2e8f0">'
        + esc(research.whyFlorida || 'Researching…') + '</p></div>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Vault angle — own the story</h3>'
        + '<p style="margin:0;white-space:pre-wrap;line-height:1.5;color:#e2e8f0">'
        + esc(research.vaultAngle || '—') + '</p></div>'
        + futurecastCardHtml(brief.futurecastFeed)
        + projectionCompCardHtml(research, p)
        + filmTraitsCardHtml(brief.filmTraits || (research && research.filmTraits))
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<h3>Board facts (elite depth)</h3>'
        + '<p class="hub-meta" style="margin:0 0 8px">'
        + (research.measurements || (p && p.htWt) ? '<strong style="color:#fff">Size:</strong> ' + esc(research.measurements || p.htWt) + '<br>' : '')
        + (research.rankings || (p && p.rankings) ? '<strong style="color:#fff">On3 ranks:</strong> ' + esc(research.rankings || p.rankings) + '<br>' : '')
        + (research.ufStaff ? '<strong style="color:#fff">UF staff:</strong> ' + esc(research.ufStaff) + '<br>' : '')
        + (research.rpm ? '<strong style="color:#fff">RPM:</strong> ' + esc(research.rpm) + '<br>' : '')
        + (research.schoolLadder || research.interestedSchools || (p && p.interestedSchools) ? '<strong style="color:#fff">School ladder:</strong> ' + esc(research.schoolLadder || research.interestedSchools || p.interestedSchools) + '<br>' : '')
        + (research.offers ? '<strong style="color:#fff">Offers:</strong> ' + esc(research.offers) + '<br>' : '')
        + (research.visits || (p && p.visitTrail) ? '<strong style="color:#fff">Visits:</strong> ' + esc(research.visits || p.visitTrail) + '<br>' : '')
        + ((p.rivals && p.rivals.length) ? '<strong style="color:#fff">Rivals:</strong> ' + esc(p.rivals.join(', ')) + '<br>' : '')
        + (research.on3ProfileUrl ? '<strong style="color:#fff">On3:</strong> ' + esc(research.on3ProfileUrl) : '')
        + (!research.rankings && !research.interestedSchools && !research.schoolLadder && !research.offers && !research.visits && !research.rpm && !(p.rivals && p.rivals.length) ? '—' : '')
        + '</p>'
        + (research.staffNotes || research.scoutingSummary
          ? '<p style="margin:8px 0 0;white-space:pre-wrap;line-height:1.45;color:#cbd5e1">'
            + esc(research.staffNotes || research.scoutingSummary) + '</p>'
          : '')
        + (research.archiveLines && research.archiveLines.length
          ? '<p style="margin:8px 0 0;white-space:pre-wrap;line-height:1.45;color:#94a3b8">'
            + research.archiveLines.map(function (l) { return esc(l); }).join('<br>') + '</p>'
          : '')
        + '<p class="hub-meta" style="margin:10px 0 0">Verified long-form target: <strong style="color:#fff">600–900 chars</strong> (cap 1000). Copy Brief for the full packet.</p>'
        + '</div>'
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
        + '<pre id="hub-bd-paste" style="margin:0;white-space:pre-wrap;font-size:12px;line-height:1.45;max-height:280px;overflow:auto;background:#0f172a;padding:12px;border-radius:8px;color:#e2e8f0">'
        + esc(brief.pasteText || '')
        + '</pre></div>';

      document.getElementById('hub-bd-copy').addEventListener('click', function () {
        copyText(brief.pasteText || '')
          .then(function () { setMsg('Brief copied → paste into Cursor or Copilot now.'); })
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
      var fcBtn = document.getElementById('hub-bd-to-fc');
      if (fcBtn) {
        fcBtn.addEventListener('click', function () {
          if (typeof onNavigate === 'function') onNavigate('#futurecast/control');
        });
      }

      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { /* ignore */ }
    }

    function openBrief(slug, name) {
      selectedSlug = slug;
      showPacketLoading(slug, name);
      setMsg('Building brief for ' + (name || slug) + '…');
      body.querySelectorAll('[data-bd-slug]').forEach(function (row) {
        row.classList.toggle('hub-ps-row--active', row.getAttribute('data-bd-slug') === slug);
      });

      return apiGet('/api/x/post-studio/brief/' + encodeURIComponent(slug), {
        retries: 1,
        timeoutMs: 30000
      })
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && (brief.message || brief.error)) || 'Brief failed');
          paintBrief(brief);
          var fc = brief.futurecastFeed;
          var fcNote = '';
          if (fc && fc.ok) {
            fcNote = ' FutureCast: ' + (fc.isNew ? 'seeded' : fc.promoted ? 'promoted' : 'refreshed');
            if (fc.decision && fc.decision.pct != null) fcNote += ' @ ' + fc.decision.pct + '%';
            fcNote += '.';
          }
          setMsg('Brief ready for ' + (brief.playerName || slug) + '.' + fcNote + ' Press Copy Brief, then paste into Cursor.');
        })
        .catch(function (err) {
          var panel = document.getElementById('hub-bd-brief');
          var msg = (err && err.message) || 'Could not build brief.';
          if (err && (err.status === 503 || /brief_timeout|timed out|warming/i.test(msg))) {
            msg = 'Server is busy warming up. Wait 30–60 seconds, then Try again.';
          }
          if (panel) {
            panel.innerHTML =
              '<h3>Player packet</h3>'
              + '<p class="hub-meta" style="color:#fca5a5">' + esc(msg) + '</p>'
              + '<button type="button" class="hub-btn" id="hub-bd-retry-brief">Try again</button>';
            var btn = document.getElementById('hub-bd-retry-brief');
            if (btn) btn.addEventListener('click', function () { openBrief(slug, name); });
          }
          setMsg(msg, true);
        });
    }

    function copyBriefDirect(slug, name) {
      setMsg('Building + copying brief for ' + (name || slug) + '…');
      return apiGet('/api/x/post-studio/brief/' + encodeURIComponent(slug), {
        retries: 1,
        timeoutMs: 30000
      })
        .then(function (brief) {
          if (!brief || !brief.ok) throw new Error((brief && (brief.message || brief.error)) || 'Brief failed');
          selectedSlug = slug;
          paintBrief(brief);
          return copyText(brief.pasteText || '').then(function () {
            setMsg('Brief copied for ' + (brief.playerName || slug) + ' — paste into Cursor/Copilot.');
          });
        })
        .catch(function (err) {
          var msg = (err && err.message) || 'Copy brief failed.';
          if (err && (err.status === 503 || /brief_timeout|timed out|warming/i.test(msg))) {
            msg = 'Server is busy warming up. Wait 30–60 seconds, then try Copy Brief again.';
          }
          setMsg(msg, true);
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
        var kind = it.deskKind || (String(slug).indexOf('uf-team-') === 0 || String(slug).indexOf('uf-program-') === 0
          ? (String(slug).indexOf('uf-program-') === 0 ? 'program' : 'team')
          : 'recruit');
        var name = formatTopicLabel(it.playerName || slug || '—', slug, kind);
        return '<tr data-bd-slug="' + esc(slug) + '" class="hub-ps-row' + (slug === selectedSlug ? ' hub-ps-row--active' : '') + '">'
          + topicCellHtml(it.playerName || slug || '—', slug, kind)
          + '<td><span class="hub-env-badge ' + statusClass(stale ? 'stale' : (it.liveBeat ? 'ok' : ((it.status && it.status.status) || st))) + '">'
          + esc(stale ? 'STALE' : (it.liveBeat ? 'LIVE' : (typeof st === 'string' ? st : '—'))) + '</span></td>'
          + '<td>' + esc(it.ageLabel || fmtTime(it.reportedAt)) + '</td>'
          + '<td class="hub-bd-beat">' + esc((it.beatText || '').slice(0, 90)) + (String(it.beatText || '').length > 90 ? '…' : '') + '</td>'
          + '<td class="hub-bd-actions">'
          + '<button type="button" class="hub-btn sm" data-bd-open="' + esc(slug) + '" data-bd-name="' + esc(name) + '">Open</button>'
          + '<button type="button" class="hub-btn secondary sm" data-bd-copy="' + esc(slug) + '" data-bd-name="' + esc(name) + '">Copy Brief</button>'
          + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="5">No beat intel in this view.</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide">'
        + '<div class="hub-dash-head" style="margin-bottom:10px">'
        + '<div><h3 style="margin:0">Beat inbox <span class="hub-meta">(' + esc(items.length) + ' shown)</span></h3>'
        + '<p class="hub-meta" style="margin:6px 0 0">Fresh (&lt;24h): <strong style="color:#fff">' + esc(freshCount)
        + '</strong> · Older: <strong style="color:#fff">' + esc(olderCount) + '</strong></p>'
        + '<p class="hub-bd-legend" style="margin:8px 0 0">'
        + '<span class="hub-env-badge hub-st-green">LIVE</span> = fresh — best to Open · '
        + '<span class="hub-env-badge hub-st-yellow">STALE</span> = older than 24h — still OK to Open for catch-up · '
        + '<span class="hub-env-badge hub-st-red">FAIL</span> = broken Open — Check API / Refresh'
        + '</p></div>'
        + '<div class="hub-btn-row">'
        + '<button type="button" class="hub-btn secondary" id="hub-bd-toggle-age">'
        + (showOlder ? 'Hide older beats' : 'Show older beats') + '</button>'
        + '</div></div>'
        + '<div class="hub-table-wrap"><table class="hub-table" style="width:100%">'
        + '<thead><tr><th>Topic / Player</th><th>Status</th><th>Age</th><th>Beat</th><th>Action</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>'
        + '<p class="hub-meta" style="margin:10px 0 0">TEAM / PROGRAM / ROSTER rows = camp, staff, schedule, facilities, current players — whole Florida football coverage, not just recruiting.</p>'
        + '</section>'
        + '<section class="hub-card hub-card-wide" id="hub-bd-brief">'
        + '<h3>Vault packet</h3>'
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

    var autoRetryTimer = null;
    var autoRetryCount = 0;
    var loadingInbox = false;

    function paintWakeShell(statusText, cachedItems) {
      loading.classList.add('hidden');
      body.classList.remove('hidden');
      var cacheNote = cachedItems && cachedItems.length
        ? '<p class="hub-meta" style="margin:0 0 12px">Showing last good inbox while kitchen wakes.</p>'
        : '';
      var listHtml = '';
      if (cachedItems && cachedItems.length) {
        allItems = cachedItems;
        // paintInbox needs the grid shell — call after injecting brief placeholder
      }
      body.innerHTML =
        '<div class="hub-card hub-card-wide" style="border-color:#334155">'
        + '<h3 style="margin:0 0 8px">Opening Beat Desk</h3>'
        + '<p class="hub-meta" style="margin:0 0 12px;color:#e2e8f0">' + esc(statusText || 'Waking kitchen…') + '</p>'
        + '<div class="hub-dash-loading" style="margin:0 0 12px">No Codemagic needed — cold start only.</div>'
        + cacheNote
        + '<div class="hub-btn-row">'
        + '<button type="button" class="hub-btn" id="hub-bd-retry">Retry now</button>'
        + '</div></div>'
        + '<div id="hub-bd-cache-host"></div>';
      var retry = document.getElementById('hub-bd-retry');
      if (retry) retry.addEventListener('click', function () {
        autoRetryCount = 0;
        load({ force: true });
      });
      if (cachedItems && cachedItems.length) {
        var host = document.getElementById('hub-bd-cache-host');
        if (host) {
          host.innerHTML = '<div id="hub-bd-cache-mount"></div>';
        }
        // Re-use paintInbox into a temp body swap: simplest — call paintInbox which overwrites body.
        // Instead keep wake card + append a compact list below.
        var rows = cachedItems.slice(0, 8).map(function (it) {
          var kind = it.deskKind || 'recruit';
          var label = formatTopicLabel(it.playerName || it.slug, it.slug, kind);
          return '<div class="hub-meta" style="padding:8px 0;border-top:1px solid #1e293b">'
            + '<strong style="color:#fff">' + esc(label) + '</strong>'
            + ' · ' + esc(it.ageLabel || '—')
            + '<div style="color:#94a3b8">' + esc((it.beatText || '').slice(0, 120)) + '</div></div>';
        }).join('');
        if (host) host.innerHTML = '<div class="hub-card hub-card-wide" style="margin-top:12px"><h3>Last inbox</h3>' + rows + '</div>';
      }
    }

    function scheduleAutoRetry() {
      if (autoRetryTimer) clearTimeout(autoRetryTimer);
      if (autoRetryCount >= MAX_AUTO_RETRIES) return;
      autoRetryCount += 1;
      var wait = AUTO_RETRY_MS * autoRetryCount;
      if (pulse) {
        pulse.innerHTML =
          '<span class="hub-env-badge hub-st-yellow">Auto-retry</span> · '
          + esc('again in ' + Math.round(wait / 1000) + 's (' + autoRetryCount + '/' + MAX_AUTO_RETRIES + ')');
      }
      autoRetryTimer = setTimeout(function () { load({ auto: true }); }, wait);
    }

    function load(opts) {
      opts = opts || {};
      if (loadingInbox && !opts.force) return Promise.resolve();
      loadingInbox = true;
      if (autoRetryTimer) clearTimeout(autoRetryTimer);

      var cached = readInboxCache();
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');

      if (pulse) {
        pulse.innerHTML = '<span class="hub-env-badge hub-st-yellow">Waking</span> · opening desk…';
      }

      var fetchApi = global.GVAdminApiFetch;
      var wake = Promise.resolve();
      if (fetchApi && fetchApi.ensureAwake) {
        wake = fetchApi.ensureAwake(apiBase, {
          onAttempt: function (info) {
            if (!pulse) return;
            pulse.innerHTML =
              '<span class="hub-env-badge hub-st-yellow">Waking</span> · '
              + esc(wakeLabel(info));
            if (loading && !loading.classList.contains('hidden')) {
              loading.textContent = wakeLabel(info);
            }
          }
        }).catch(function () { return null; });
      }

      return wake
        .then(function () {
          return apiGet('/api/x/post-studio/inbox?desk=1&limit=40', {
            skipWake: true,
            retries: 5,
            retryDelayMs: 2200,
            onAttempt: function (info) {
              if (!pulse) return;
              pulse.innerHTML =
                '<span class="hub-env-badge hub-st-yellow">Loading</span> · '
                + esc(info.error ? wakeLabel(info) : ('beat inbox ' + ((info.attempt || 0) + 1) + '/' + (info.maxAttempts || '?')));
            }
          });
        })
        .then(function (inbox) {
          loadingInbox = false;
          autoRetryCount = 0;
          allItems = (inbox && inbox.items) || [];
          writeInboxCache(allItems);
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          paintInbox();
          updatePulse({ skipEnsure: true, retries: 0 });
          var freshCount = allItems.filter(function (it) {
            return it.ageMs == null || it.ageMs <= FRESH_MS;
          }).length;
          setMsg(
            freshCount
              ? 'Desk ready — ' + freshCount + ' fresh beat(s). Press Open or Copy Brief.'
              : 'No fresh beats (under 24h). Showing older — press Show older / Open for catch-up posts.'
          );
        })
        .catch(function (err) {
          loadingInbox = false;
          var msg = (err && err.message) || 'Could not load inbox';
          // One calm status — never triple-spam Kitchen busy / 502.
          if (pulse) {
            pulse.innerHTML =
              '<span class="hub-env-badge hub-st-yellow">Waking</span> · '
              + esc(msg);
          }
          paintWakeShell(msg, cached && cached.items);
          setMsg('');
          scheduleAutoRetry();
        });
    }

    load();
    if (pulseTimer) clearInterval(pulseTimer);
    pulseTimer = setInterval(function () { updatePulse({ skipEnsure: true }); }, 90000);
  }

  global.GVAdminBeatDesk = {
    render: render,
    formatTopicLabel: formatTopicLabel,
    topicCellHtml: topicCellHtml,
  };
})(typeof window !== 'undefined' ? window : global);
