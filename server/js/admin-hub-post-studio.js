/**
 * Admin Hub — in-shell X Post Studio (read-heavy + controlled actions).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  function pushAct(ctx, entry) {
    if (ctx && typeof ctx.pushActivity === 'function') ctx.pushActivity(entry);
    else if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
      global.GVAdminHub.pushActivity(entry);
    }
  }

  function statusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s.indexOf('fail') >= 0 || s === 'error' || s === 'red' || s === 'blocked') return 'hub-st-red';
    if (s.indexOf('review') >= 0 || s === 'warning' || s === 'yellow' || s === 'pending') return 'hub-st-yellow';
    if (s === 'sent' || s === 'ready' || s === 'ok' || s === 'green' || s === 'pass') return 'hub-st-green';
    return 'hub-st-unknown';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};
    var selectedSlug = '';
    var selectedDraftId = '';

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Post Studio</h2>'
      + '<p class="hub-dash-sub">Inbox, drafts, compose, and leak audit — posting APIs stay in Full Ops</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-ps-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-ps-full">Full Ops</button>'
      + '</div></div>'
      + '<div id="hub-ps-loading" class="hub-dash-loading">Loading Post Studio...</div>'
      + '<div id="hub-ps-body" class="hidden"></div>'
      + '<p id="hub-ps-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-ps-loading');
    var body = document.getElementById('hub-ps-body');
    var msg = document.getElementById('hub-ps-msg');

    document.getElementById('hub-ps-full').addEventListener('click', function () {
      onNavigate('#dashboard/ops');
    });
    document.getElementById('hub-ps-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(bundle) {
      var config = bundle.config || {};
      var pipeline = bundle.pipeline || config.pipeline || {};
      var inbox = bundle.inbox || {};
      var queue = bundle.queue || {};
      var failures = bundle.failures || {};
      var audit = bundle.audit || {};
      var elite = bundle.elite || {};

      var counts = config.counts || queue.counts || (pipeline.queue || {}) || {};
      var hub = pipeline.hub || {};
      var detectives = pipeline.detectives || {};
      var inboxItems = inbox.items || [];
      var drafts = (queue.items || []).filter(function (it) {
        var st = String(it.status || '').toLowerCase();
        return st === 'hub_review' || st === 'pending' || st === 'draft';
      });
      var failEntries = failures.entries || [];
      var eliteEntries = elite.entries || [];

      var inboxHtml = inboxItems.slice(0, 12).map(function (it) {
        var st = (it.status && it.status.label) || (it.status && it.status.status) || it.status || '-';
        var slug = it.slug || '';
        return '<tr data-ps-slug="' + esc(slug) + '" class="hub-ps-row' + (slug === selectedSlug ? ' hub-ps-row--active' : '') + '">'
          + '<td><strong style="color:#fff">' + esc(it.playerName || slug || '-') + '</strong>'
          + '<div class="hub-meta" style="margin:2px 0 0">' + esc(slug) + '</div></td>'
          + '<td><span class="hub-env-badge ' + statusClass(st) + '">' + esc(typeof st === 'string' ? st : '-') + '</span></td>'
          + '<td>' + esc(it.ageLabel || fmtTime(it.reportedAt)) + '</td>'
          + '<td>' + esc((it.beatText || '').slice(0, 90)) + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="4">Inbox empty</td></tr>';

      var draftHtml = drafts.slice(0, 10).map(function (it) {
        return '<tr data-ps-draft="' + esc(it.id) + '" class="hub-ps-row' + (it.id === selectedDraftId ? ' hub-ps-row--active' : '') + '">'
          + '<td><strong style="color:#fff">' + esc(it.playerName || it.playerSlug || it.id) + '</strong>'
          + '<div class="hub-meta" style="margin:2px 0 0">' + esc(it.status || '-') + '</div></td>'
          + '<td>' + esc((it.text || '').slice(0, 120)) + '</td>'
          + '<td>' + esc(fmtTime(it.createdAt || it.scheduledAt)) + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="3">No hub_review / pending drafts</td></tr>';

      var failHtml = failEntries.slice(0, 6).map(function (e, i) {
        return '<li class="hub-issue hub-st-red">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(e.slug || e.reason || 'compose fail') + '</strong>'
          + '<span>' + esc((e.reason || e.lastReason || '') + (e.at ? ' · ' + fmtTime(e.at) : '')) + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>No compose failures</strong><span>Pipeline compose looks clean.</span></div></li>';

      var auditPass = audit.pass === true || audit.ok === true;
      var auditCls = audit.pass === false ? 'hub-st-red' : (auditPass ? 'hub-st-green' : 'hub-st-unknown');
      var violHtml = (audit.violations || []).slice(0, 5).map(function (v, i) {
        return '<li class="hub-issue hub-st-red">'
          + '<span class="hub-issue-num">' + (i + 1) + '</span>'
          + '<div class="hub-issue-body"><strong>' + esc(v.slug || v.id) + '</strong>'
          + '<span>' + esc((v.leakTypes || []).join(', ') || v.preview || '') + '</span></div></li>';
      }).join('') || '<li class="hub-issue hub-st-green"><span class="hub-issue-num">OK</span><div class="hub-issue-body"><strong>Leak audit clear</strong><span>G4 gate looking good.</span></div></li>';

      var eliteHtml = eliteEntries.slice(0, 5).map(function (e) {
        return '<tr><td>' + esc(fmtTime(e.at || e.timestamp)) + '</td><td>' + esc(e.playerName || e.eventType || '-') + '</td>'
          + '<td>' + esc((e.caption || e.finalCaption || e.skipReason || '').slice(0, 100)) + '</td></tr>';
      }).join('') || '<tr><td colspan="3">No elite logs</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + statusClass(hub.hubMode || 'unknown') + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Hub mode</span>'
        + '<strong class="hub-overall-val">' + esc(String(hub.hubMode || config.hubMode || 'unknown').toUpperCase()) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Daily sent ' + esc((hub.dailySent != null ? hub.dailySent : (config.stats && config.stats.dailySent)) || 0)
        + ' / ' + esc((config.stats && config.stats.dailyMax) || config.dailyMax || '-') + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 4px">Inbox: <strong style="color:#fff">' + esc(inbox.totalUnqueued != null ? inbox.totalUnqueued : inboxItems.length) + '</strong>'
        + ' · Drafts: <strong style="color:#fff">' + esc(counts.hub_review != null ? counts.hub_review : drafts.length) + '</strong>'
        + ' · Pending: <strong style="color:#fff">' + esc(counts.pending != null ? counts.pending : '-') + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">Detectives: ' + esc(detectives.enabled ? 'on' : 'off')
        + (detectives.counts ? ' · ' + esc(JSON.stringify(detectives.counts).slice(0, 80)) : '')
        + '</p></div>'
        + '<div class="hub-dash-primary">'
        + '<button type="button" class="hub-btn" id="hub-ps-compose">Compose selected</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-ps-dismiss">Dismiss draft</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-ps-mark">Mark posted</button>'
        + '</div></div>'
        + '<p class="hub-meta" style="margin:12px 0 0">Selected slug: <strong style="color:#fff" id="hub-ps-sel-slug">' + esc(selectedSlug || 'none') + '</strong>'
        + ' · Draft: <strong style="color:#fff" id="hub-ps-sel-draft">' + esc(selectedDraftId || 'none') + '</strong></p>'
        + '</section>'

        + '<section class="hub-card hub-card-wide"><h3>Intel Inbox</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>Status</th><th>Age</th><th>Beat</th></tr></thead><tbody>'
        + inboxHtml + '</tbody></table></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Drafts (hub review / pending)</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>Text</th><th>Created</th></tr></thead><tbody>'
        + draftHtml + '</tbody></table></div></section>'

        + '<section class="hub-card"><h3>Compose failures</h3><ol class="hub-issue-list">' + failHtml + '</ol></section>'
        + '<section class="hub-card ' + auditCls + '"><h3>G4 leak audit</h3>'
        + '<p class="hub-meta">Pass: ' + esc(audit.pass == null ? 'unknown' : String(audit.pass))
        + ' · Leaks: ' + esc(audit.leakCount != null ? audit.leakCount : 0) + '</p>'
        + '<ol class="hub-issue-list">' + violHtml + '</ol></section>'

        + '<section class="hub-card hub-card-wide"><h3>Elite caption logs</h3>'
        + '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>When</th><th>Player</th><th>Caption / skip</th></tr></thead><tbody>'
        + eliteHtml + '</tbody></table></div></section>'

        + '<section class="hub-card hub-card-wide"><h3>Policy</h3>'
        + '<p class="hub-meta">In-shell: Compose, Dismiss, Mark posted (manual X). Full Ops only: force-post, detectives process/backfill, refill, promote, post-api.</p>'
        + '</section>'
        + '</div>';

      // row selection styles
      if (!document.getElementById('hub-ps-style')) {
        var st = document.createElement('style');
        st.id = 'hub-ps-style';
        st.textContent = '.hub-ps-row{cursor:pointer}.hub-ps-row:hover td{background:rgba(250,70,22,.08)}.hub-ps-row--active td{background:rgba(250,70,22,.16)}';
        document.head.appendChild(st);
      }

      body.classList.remove('hidden');
      wireActions();
    }

    function wireActions() {
      body.querySelectorAll('[data-ps-slug]').forEach(function (row) {
        row.addEventListener('click', function () {
          selectedSlug = row.getAttribute('data-ps-slug') || '';
          var el = document.getElementById('hub-ps-sel-slug');
          if (el) el.textContent = selectedSlug || 'none';
          body.querySelectorAll('[data-ps-slug]').forEach(function (r) {
            r.classList.toggle('hub-ps-row--active', r.getAttribute('data-ps-slug') === selectedSlug);
          });
        });
      });
      body.querySelectorAll('[data-ps-draft]').forEach(function (row) {
        row.addEventListener('click', function () {
          selectedDraftId = row.getAttribute('data-ps-draft') || '';
          var el = document.getElementById('hub-ps-sel-draft');
          if (el) el.textContent = selectedDraftId || 'none';
          body.querySelectorAll('[data-ps-draft]').forEach(function (r) {
            r.classList.toggle('hub-ps-row--active', r.getAttribute('data-ps-draft') === selectedDraftId);
          });
        });
      });

      var composeBtn = document.getElementById('hub-ps-compose');
      if (composeBtn) {
        composeBtn.addEventListener('click', function () {
          if (!selectedSlug) { setMsg('Select an inbox player first', true); return; }
          composeBtn.disabled = true;
          setMsg('Composing draft for ' + selectedSlug + '...');
          apiPost('/api/x/post-studio/compose', { slug: selectedSlug })
            .then(function () {
              setMsg('Draft composed for ' + selectedSlug);
              pushAct(ctx, { status: 'success', message: 'Composed draft: ' + selectedSlug, subsystem: 'post-studio' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Compose failed', true); })
            .finally(function () { composeBtn.disabled = false; });
        });
      }

      var dismissBtn = document.getElementById('hub-ps-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          if (!selectedDraftId) { setMsg('Select a draft first', true); return; }
          if (!window.confirm('Dismiss draft ' + selectedDraftId + '?')) return;
          dismissBtn.disabled = true;
          setMsg('Dismissing draft...');
          apiPost('/api/x/post-studio/' + encodeURIComponent(selectedDraftId) + '/dismiss', {})
            .then(function () {
              setMsg('Draft dismissed');
              selectedDraftId = '';
              pushAct(ctx, { status: 'success', message: 'Dismissed draft', subsystem: 'post-studio' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Dismiss failed', true); })
            .finally(function () { dismissBtn.disabled = false; });
        });
      }

      var markBtn = document.getElementById('hub-ps-mark');
      if (markBtn) {
        markBtn.addEventListener('click', function () {
          if (!selectedDraftId) { setMsg('Select a draft first', true); return; }
          if (!window.confirm('Mark draft as manually posted on X? This does not call the X API.')) return;
          var tweetUrl = window.prompt('Optional tweet URL (or leave blank)', '') || '';
          markBtn.disabled = true;
          setMsg('Marking posted...');
          apiPost('/api/x/post-studio/' + encodeURIComponent(selectedDraftId) + '/mark-posted', { tweetUrl: tweetUrl })
            .then(function () {
              setMsg('Marked as posted');
              selectedDraftId = '';
              pushAct(ctx, { status: 'success', message: 'Marked draft posted', subsystem: 'post-studio' });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Mark posted failed', true); })
            .finally(function () { markBtn.disabled = false; });
        });
      }
    }

    function load() {
      if (loading) loading.classList.remove('hidden');
      if (body) body.classList.add('hidden');
      setMsg('');
      Promise.all([
        apiGet('/api/x/post-studio/config').catch(function () { return {}; }),
        apiGet('/api/x/post-studio/pipeline').catch(function () { return {}; }),
        apiGet('/api/x/post-studio/inbox?limit=40').catch(function () { return { items: [] }; }),
        apiGet('/api/x/post-studio/queue?limit=50').catch(function () { return { items: [] }; }),
        apiGet('/api/x/post-studio/compose-failures?limit=40').catch(function () { return { entries: [] }; }),
        apiGet('/api/x/post-studio/leak-audit').catch(function (e) {
          // 409 still returns useful body via apiGet? may throw — keep soft
          return { pass: false, leakCount: '?', ok: false, error: e && e.message };
        }),
        apiGet('/api/x/autoposter/elite/logs?limit=20').catch(function () { return { entries: [] }; })
      ])
        .then(function (rows) {
          paint({
            config: rows[0],
            pipeline: rows[1],
            inbox: rows[2],
            queue: rows[3],
            failures: rows[4],
            audit: rows[5],
            elite: rows[6]
          });
        })
        .catch(function (e) {
          if (body) {
            body.innerHTML = '<p class="err">' + esc(e.message || 'Failed to load Post Studio') + '</p>';
            body.classList.remove('hidden');
          }
        })
        .finally(function () {
          if (loading) loading.classList.add('hidden');
        });
    }

    load();
  }

  global.GVAdminPostStudio = { render: render };
})(window);
