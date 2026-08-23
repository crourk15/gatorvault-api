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

      var vf = data.vaultFeed2028LastReport || null;
      var vfs = (vf && vf.summary) || {};
      var vfCreated = (vf && vf.created) || [];
      var vfUpdated = (vf && vf.updated) || [];
      var vfUnresolved = (vf && vf.unresolved) || [];
      var vfStaff = (vf && vf.blockedStaff) || [];
      var vf2027 = (vf && vf.skipped2027) || [];
      var vfEmpty = (vf && (vf.emptyReason || (vfs && vfs.emptyReason))) || '';
      var vfBeats = vf ? (vfs.beatsFetched != null ? vfs.beatsFetched : vf.beatsFetched) : null;
      var vfCands = vf ? (vfs.candidatesNamed != null ? vfs.candidatesNamed : vf.candidatesNamed) : null;
      var vfRunning = !!(vf && vf.status === 'running');
      var vfHtml = !vf
        ? '<p class="hub-meta">No vault-feed run yet — waits for 7am / 7pm ET cron (or Run now).</p>'
        : vfRunning
        ? '<p class="hub-meta" style="color:#fbbf24"><strong>RUNNING</strong> since ' + esc(vf.startedAt || '—')
          + ' — beat refresh + allowlist can take 1–3 minutes. Zeros below are a placeholder, not finished proof.</p>'
          + '<p class="hub-meta">' + esc(vf.message || 'Proof fills when finished.') + '</p>'
        : '<p class="hub-meta">Last run: <strong style="color:#fff">' + esc(vf.finishedAt || vf.startedAt || '—') + '</strong>'
          + (vf.status ? ' · ' + esc(vf.status) : '')
          + (vf.dryRun ? ' · dry-run' : '')
          + (vf.beatSource ? ' · beats:' + esc(vf.beatSource) : '')
          + '</p>'
          + '<div class="hub-dash-grid" style="margin:8px 0">'
          + '<section class="hub-card"><h3>Created</h3><p class="hub-kpi">' + esc(vfs.createdCount || 0) + '</p></section>'
          + '<section class="hub-card"><h3>Updated</h3><p class="hub-kpi">' + esc(vfs.updatedCount || 0) + '</p></section>'
          + '<section class="hub-card"><h3>Unresolved</h3><p class="hub-kpi">' + esc(vfs.unresolvedCount || 0) + '</p></section>'
          + '<section class="hub-card"><h3>Staff blocked</h3><p class="hub-kpi">' + esc(vfs.blockedStaffCount || 0) + '</p></section>'
          + '<section class="hub-card"><h3>2027 skipped</h3><p class="hub-kpi">' + esc(vfs.skipped2027Count || 0) + '</p></section>'
          + '<section class="hub-card"><h3>Allowlist cov</h3><p class="hub-kpi">' + esc(vfs.allowlistCoveragePct != null ? vfs.allowlistCoveragePct + '%' : '—') + '</p></section>'
          + '</div>'
          + '<p class="hub-meta">Beats fetched: <strong style="color:#fff">' + esc(vfBeats != null ? vfBeats : '—') + '</strong>'
          + ' · Named 2028+ candidates: <strong style="color:#fff">' + esc(vfCands != null ? vfCands : '—') + '</strong></p>'
          + ((vf.on3Articles) ? '<p class="hub-meta">On3 articles: scanned ' + esc(vf.on3Articles.scanned != null ? vf.on3Articles.scanned : '—') + ' · as posts ' + esc(vf.on3Articles.posts != null ? vf.on3Articles.posts : '—') + (vf.on3Articles.skippedNoId ? ' · no-id ' + esc(vf.on3Articles.skippedNoId) : '') + '</p>' : '')
          + (vfEmpty ? '<p class="hub-meta" style="color:#fbbf24">Empty reason: ' + esc(vfEmpty) + '</p>' : '')
          + ((vf.beatRefresh && vf.beatRefresh.error) ? '<p class="hub-meta" style="color:#fca5a5">Beat refresh: ' + esc(vf.beatRefresh.error) + '</p>' : '')
          + ((vf.allowlistIntel && vf.allowlistIntel.error) ? '<p class="hub-meta" style="color:#fca5a5">Allowlist: ' + esc(vf.allowlistIntel.error) + '</p>' : '')
          + '<p class="hub-meta">Created (proof): ' + esc(vfCreated.slice(0, 8).map(function (r) { return r.playerName || r.playerSlug; }).join(', ') || 'none') + '</p>'
          + '<div style="margin:10px 0 6px"><p class="hub-meta" style="margin:0 0 4px;color:#fff"><strong>Updated detail</strong> — what FutureCast/store changed</p>'
          + (vfUpdated.length
            ? '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Player</th><th>What changed</th><th>Beat / source</th></tr></thead><tbody>'
              + vfUpdated.slice(0, 20).map(function (r) {
                var errMap = {
                  blocked_not_recruit: 'Blocked as phantom (usually false ATH default — should be fixed)',
                  staff_not_recruit: 'Staff/coach collision',
                  thin_board: 'Thin board — need On3 hydrate',
                  store_upsert_failed: 'Store upsert failed',
                  current_roster_player: 'Current roster collision'
                };
                var what = r.whatChanged
                  || (r.feedOk === false
                    ? ('Feed failed: ' + (errMap[r.feedError] || r.feedError || 'unknown'))
                    : null)
                  || (r.action === 'fed_futurecast' ? 'FutureCast intel re-applied from beat' : null)
                  || (r.action === 'would_update' ? 'dry-run would update' : null)
                  || r.action
                  || 'updated';
                var src = (r.handle ? '@' + r.handle + ' — ' : '') + (r.sourcePreview || '');
                var ufBit = (r.ufPct != null && String(what).indexOf('UF%') < 0) ? (' · UF ' + r.ufPct + '%') : '';
                return '<tr><td><strong style="color:#fff">' + esc(r.playerName || r.playerSlug || '—') + '</strong>'
                  + '<div class="hub-meta">' + esc(r.playerSlug || '') + (r.classYear ? ' · ' + esc(r.classYear) : '') + '</div></td>'
                  + '<td class="hub-meta">' + esc(what) + esc(ufBit) + '</td>'
                  + '<td class="hub-meta">' + esc(src.slice(0, 160) || '—') + '</td></tr>';
              }).join('')
              + '</tbody></table></div>'
            : '<p class="hub-meta">none</p>')
          + '</div>'
          + '<div style="margin:10px 0 6px"><p class="hub-meta" style="margin:0 0 4px;color:#fff"><strong>Unresolved detail</strong> — why auto-vault refused (open these in Beat Desk)</p>'
          + (vfUnresolved.length
            ? '<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>Name / cue</th><th>Reason</th><th>Beat / source</th></tr></thead><tbody>'
              + vfUnresolved.slice(0, 24).map(function (r) {
                var reasonMap = {
                  weak_identity: 'Weak identity — need clearer On3/name match',
                  missing_on3: 'Missing On3 profile / ID',
                  on3_id_missing: 'Missing On3 ID',
                  no_on3_id: 'Missing On3 ID',
                  provision_failed: 'Provision failed',
                  untrusted_writer: 'Writer not on trusted beat list',
                  class_year_out_of_scope: 'Class year out of 2028+ scope',
                  blocked_staff: 'Staff/coach name blocked',
                  staff_not_recruit: 'Staff/coach — not a recruit',
                  current_roster_player: 'Matches current UF roster player',
                  blocked_not_recruit: 'Blocked as phantom/alumni (or false ATH shell)',
                  slug_name_identity_mismatch: 'Slug/name identity mismatch',
                  vault_feed_weak_identity: 'Weak identity — queued for review',
                  max_creates_reached: 'Hit create cap this run'
                };
                var reason = reasonMap[r.reason] || r.reason || 'unresolved';
                var src = (r.handle ? '@' + r.handle + ' — ' : '') + (r.sourcePreview || '');
                return '<tr><td><strong style="color:#fff">' + esc(r.playerName || r.playerSlug || '—') + '</strong>'
                  + '<div class="hub-meta">' + esc(r.playerSlug || '') + (r.classYear ? ' · ' + esc(r.classYear) : '')
                  + (r.queued ? ' · queued for review' : '') + '</div></td>'
                  + '<td class="hub-meta" style="color:#fbbf24">' + esc(reason) + '</td>'
                  + '<td class="hub-meta">' + esc(src.slice(0, 160) || '—') + '</td></tr>';
              }).join('')
              + '</tbody></table></div>'
            : '<p class="hub-meta">none</p>')
          + '</div>'
          + (vfStaff.length ? '<p class="hub-meta">Staff blocked: ' + esc(vfStaff.slice(0, 5).map(function (r) { return r.playerName; }).join(', ')) + '</p>' : '')
          + (vf2027.length ? '<p class="hub-meta">2027 handpick-only skips: ' + esc(String(vf2027.length)) + '</p>' : '');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-st-green"><h3>Locked 2027</h3><p class="hub-kpi">' + esc(c.locked2027 || 0) + '</p><p class="hub-meta">Closing Class — not expandable</p></section>'
        + '<section class="hub-card"><h3>Locked 2028 code</h3><p class="hub-kpi">' + esc(c.locked2028 || 0) + '</p><p class="hub-meta">Hunt list in code</p></section>'
        + '<section class="hub-card"><h3>Admin 2028 extras</h3><p class="hub-kpi">' + esc(c.admin2028 || 0) + '</p><p class="hub-meta">Soft-adds from desk / resolve</p></section>'
        + '<section class="hub-card"><h3>Board 2028</h3><p class="hub-kpi">' + esc(c.board2028 || 0) + '</p><p class="hub-meta">Target board rows · watch ' + esc(c.earlyWatch || 0) + '</p></section>'
        + '</div>'
        + '<p class="hub-meta" style="margin:12px 0">' + esc((data.notes && data.notes.deskFeed) || '') + '</p>'
        + '<p class="hub-meta" style="margin:0 0 12px">' + esc((data.notes && data.notes.vaultFeed2028) || '') + '</p>'
        + '<div class="hub-card" style="margin-bottom:12px">'
        + '<div class="hub-btn-row" style="justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<h3 style="margin:0">Vault feed 2028+ (7am / 7pm ET proof)</h3>'
        + '<button type="button" class="hub-btn secondary" id="hub-fc-vault-feed-run">Run now</button>'
        + '</div>'
        + '<p id="hub-fc-vault-feed-status" class="hub-meta" style="margin:0 0 8px;color:#fbbf24"></p>'
        + vfHtml
        + '</div>'
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
        + '<h3>Why we chase (live edit)</h3>'
        + '<p class="hub-meta" style="margin:0 0 8px">Overrides Priority Chase card copy on the next API hit — no Codemagic. Max 280 chars. Clear to resume auto-generated nugget.</p>'
        + '<div class="hub-btn-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end">'
        + '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8">Slug'
        + '<input id="hub-fc-why-slug" type="text" placeholder="izayah-vickers" style="min-width:180px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff"></label>'
        + '</div>'
        + '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;margin-top:8px">Why we chase'
        + '<textarea id="hub-fc-why-text" rows="3" maxlength="280" placeholder="Florida already owns this CB on the board — staff is locked on Vickers…" style="width:100%;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;resize:vertical"></textarea></label>'
        + '<div class="hub-btn-row" style="margin-top:8px;gap:8px">'
        + '<button type="button" class="hub-btn" id="hub-fc-why-save">Save override</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-fc-why-clear">Clear override</button>'
        + '<button type="button" class="hub-btn secondary" id="hub-fc-why-load">Load current</button>'
        + '</div>'
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

      var whySave = document.getElementById('hub-fc-why-save');
      var whyClear = document.getElementById('hub-fc-why-clear');
      var whyLoad = document.getElementById('hub-fc-why-load');
      function whySlug() {
        return (document.getElementById('hub-fc-why-slug').value || '').trim();
      }
      function whyText() {
        return (document.getElementById('hub-fc-why-text').value || '').trim();
      }
      if (whySave) {
        whySave.addEventListener('click', function () {
          var slug = whySlug();
          var text = whyText();
          if (!slug || !text) {
            setMsg('Slug and Why we chase text required.', true);
            return;
          }
          whySave.disabled = true;
          apiPost('/api/admin/hub/chase-why', { slug: slug, text: text })
            .then(function (j) {
              if (!j.ok) {
                setMsg(j.error || 'Save failed', true);
                return;
              }
              setMsg('Saved Why we chase for ' + slug + ' — live on next Priority Chase refresh.');
              pushAct({ status: 'success', message: 'Chase why override: ' + slug, subsystem: 'futurecast' });
            })
            .catch(function (e) { setMsg(e.message || 'Save failed', true); })
            .finally(function () { whySave.disabled = false; });
        });
      }
      if (whyClear) {
        whyClear.addEventListener('click', function () {
          var slug = whySlug();
          if (!slug) {
            setMsg('Slug required to clear.', true);
            return;
          }
          whyClear.disabled = true;
          apiPost('/api/admin/hub/chase-why/' + encodeURIComponent(slug) + '/clear', {})
            .then(function (j) {
              setMsg(j.cleared ? ('Cleared override for ' + slug) : ('No override for ' + slug));
              var ta = document.getElementById('hub-fc-why-text');
              if (ta) ta.value = '';
            })
            .catch(function (e) { setMsg(e.message || 'Clear failed', true); })
            .finally(function () { whyClear.disabled = false; });
        });
      }
      if (whyLoad) {
        whyLoad.addEventListener('click', function () {
          var slug = whySlug();
          if (!slug) {
            setMsg('Slug required to load.', true);
            return;
          }
          whyLoad.disabled = true;
          apiGet('/api/admin/hub/chase-why/' + encodeURIComponent(slug))
            .then(function (j) {
              var ta = document.getElementById('hub-fc-why-text');
              if (ta) ta.value = j.override || j.active || j.generated || '';
              setMsg(j.override ? ('Loaded override for ' + slug) : ('No override — showing generated for ' + slug));
            })
            .catch(function (e) { setMsg(e.message || 'Load failed', true); })
            .finally(function () { whyLoad.disabled = false; });
        });
      }

      var vfRun = document.getElementById('hub-fc-vault-feed-run');
      var vfStatus = document.getElementById('hub-fc-vault-feed-status');
      function setVfStatus(text, isErr) {
        if (!vfStatus) return;
        vfStatus.textContent = text || '';
        vfStatus.style.color = isErr ? '#fca5a5' : '#fbbf24';
      }
      if (vf && vf.status === 'running') {
        setVfStatus('Vault feed is running… proof will fill when finished. Auto-refreshing.');
        if (vfRun) vfRun.disabled = true;
        setTimeout(function () { load(); }, 4000);
      }
      if (vfRun) {
        vfRun.addEventListener('click', function () {
          vfRun.disabled = true;
          setVfStatus('Starting vault feed…');
          setMsg('Starting vault feed…');
          apiPost('/api/admin/hub/vault-feed-2028/run', { dryRun: false })
            .then(function (j) {
              if (!j || j.ok === false) throw new Error((j && j.error) || 'Vault feed failed to start');
              if (j.alreadyRunning) {
                setVfStatus('Already running — waiting for proof…');
                setMsg('Vault feed already running.');
              } else {
                setVfStatus('Running in background… this can take 1–2 minutes. Watching for proof.');
                setMsg('Vault feed started — do not close this tab; proof updates when done.');
              }
              pushAct({ status: 'success', message: 'Vault feed 2028 started', subsystem: 'futurecast' });
              var tries = 0;
              function poll() {
                tries += 1;
                return apiGet('/api/admin/hub/vault-feed-2028')
                  .then(function (r) {
                    var rep = r && r.report;
                    if (rep && rep.status === 'running') {
                      setVfStatus('Still running… (' + tries + ')');
                      if (tries < 45) return setTimeout(poll, 4000);
                      setVfStatus('Still running — tap Refresh on this page in a minute.', true);
                      vfRun.disabled = false;
                      return null;
                    }
                    var s = (rep && rep.summary) || {};
                    var emptyBit = s.emptyReason ? ' · ' + s.emptyReason : '';
                    setVfStatus('Done — created ' + (s.createdCount || 0) + ', updated ' + (s.updatedCount || 0) + ', unresolved ' + (s.unresolvedCount || 0) + ', beats ' + (s.beatsFetched != null ? s.beatsFetched : '—') + emptyBit, !!s.emptyReason && !(s.createdCount || s.updatedCount));
                    setMsg('Vault feed done — created ' + (s.createdCount || 0) + ', updated ' + (s.updatedCount || 0) + emptyBit);
                    vfRun.disabled = false;
                    return load();
                  })
                  .catch(function (e) {
                    if (tries < 45) return setTimeout(poll, 4000);
                    setVfStatus(e.message || 'Poll failed', true);
                    vfRun.disabled = false;
                  });
              }
              setTimeout(poll, 3000);
            })
            .catch(function (e) {
              setVfStatus(e.message || 'Vault feed failed', true);
              setMsg(e.message || 'Vault feed failed', true);
              vfRun.disabled = false;
            });
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
