/**
 * Admin Hub — Unresolved Predictions Queue (never-late Pass 1).
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

  function pushAct(entry) {
    if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
      global.GVAdminHub.pushActivity(entry);
    }
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var apiPost = ctx.apiPost;

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Unresolved Predictions</h2>'
      + '<p class="hub-dash-sub">RPM / crystal-ball teasers that could not be attached to a player — never silent-skip</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-upq-refresh">Refresh</button>'
      + '</div></div>'
      + '<div id="hub-upq-loading" class="hub-dash-loading">Loading unresolved predictions...</div>'
      + '<div id="hub-upq-body" class="hidden"></div>'
      + '<p id="hub-upq-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-upq-loading');
    var body = document.getElementById('hub-upq-body');
    var msg = document.getElementById('hub-upq-msg');

    document.getElementById('hub-upq-refresh').addEventListener('click', load);

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(data) {
      var items = data.items || [];
      var byReason = data.byReason || {};
      var reasonBits = Object.keys(byReason).map(function (k) {
        return esc(k) + ' ' + esc(byReason[k]);
      }).join(' · ') || 'none';

      var rows = items.map(function (it) {
        var link = it.url
          ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="color:#93c5fd">Open</a>'
          : '-';
        return '<tr data-id="' + esc(it.id) + '">'
          + '<td><strong style="color:#fff">' + esc(it.title) + '</strong>'
          + '<div class="hub-meta" style="margin-top:4px">' + esc((it.textPreview || '').slice(0, 140)) + '</div></td>'
          + '<td>' + esc(it.reason) + '<div class="hub-meta">' + esc(it.source) + '</div></td>'
          + '<td>' + esc(it.handle || it.writerName || '-') + '</td>'
          + '<td>' + esc(fmtTime(it.createdAt)) + '<div class="hub-meta">seen ×' + esc(it.seenCount || 1) + '</div></td>'
          + '<td>' + link + '</td>'
          + '<td><div class="hub-btn-row">'
          + '<button type="button" class="hub-btn hub-upq-resolve" data-id="' + esc(it.id) + '">Resolve</button>'
          + '<button type="button" class="hub-btn secondary hub-upq-dismiss" data-id="' + esc(it.id) + '">Dismiss</button>'
          + '</div></td>'
          + '</tr>';
      }).join('');

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + (data.openCount ? 'hub-st-red' : 'hub-st-green') + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Open</span>'
        + '<strong class="hub-overall-val">' + esc(data.openCount != null ? data.openCount : items.length) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Updated ' + esc(fmtTime(data.updatedAt)) + '</p></div>'
        + '<div><p class="hub-meta" style="margin:0">By reason: ' + reasonBits + '</p>'
        + '<p class="hub-meta" style="margin:8px 0 0">Resolve with a player slug to attach + add 2028 allowlist.</p></div>'
        + '</div></section>'
        + '<section class="hub-card hub-card-wide">'
        + '<h3>Open cases</h3>'
        + (items.length
          ? '<div class="hub-table-wrap"><table class="hub-table"><thead><tr>'
            + '<th>Signal</th><th>Reason</th><th>Writer</th><th>When</th><th>Link</th><th>Actions</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<p class="hub-meta">Queue clear — no unresolved prediction teasers.</p>')
        + '</section></div>';

      body.classList.remove('hidden');

      Array.prototype.forEach.call(body.querySelectorAll('.hub-upq-resolve'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var slug = window.prompt('Player slug to resolve (e.g. cyion-smith):', '');
          if (slug == null) return;
          slug = String(slug).trim().toLowerCase();
          if (!slug) {
            setMsg('Slug required to resolve', true);
            return;
          }
          var name = window.prompt('Display name (optional):', '') || '';
          btn.disabled = true;
          setMsg('Resolving...');
          apiPost('/api/admin/unresolved-predictions/' + encodeURIComponent(id) + '/resolve', {
            playerSlug: slug,
            playerName: name || undefined,
            classYear: 2028,
            addAllowlist: true
          })
            .then(function () {
              setMsg('Resolved → ' + slug + ' (allowlist updated)');
              pushAct({
                status: 'success',
                message: 'Unresolved prediction resolved → ' + slug,
                subsystem: 'recruiting:unresolved-predictions'
              });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Resolve failed', true); })
            .finally(function () { btn.disabled = false; });
        });
      });

      Array.prototype.forEach.call(body.querySelectorAll('.hub-upq-dismiss'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          if (!window.confirm('Dismiss this unresolved prediction?')) return;
          btn.disabled = true;
          apiPost('/api/admin/unresolved-predictions/' + encodeURIComponent(id) + '/dismiss', {
            note: 'dismissed_from_hub'
          })
            .then(function () {
              setMsg('Dismissed');
              pushAct({
                status: 'warning',
                message: 'Unresolved prediction dismissed',
                subsystem: 'recruiting:unresolved-predictions'
              });
              return load();
            })
            .catch(function (e) { setMsg(e.message || 'Dismiss failed', true); })
            .finally(function () { btn.disabled = false; });
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      apiGet('/api/admin/unresolved-predictions?status=open&limit=50')
        .then(function (data) {
          loading.classList.add('hidden');
          paint(data || {});
        })
        .catch(function (e) {
          loading.classList.add('hidden');
          setMsg(e.message || 'Failed to load queue', true);
        });
    }

    load();
  }

  global.GVAdminUnresolvedPredictions = { render: render };
})(typeof window !== 'undefined' ? window : global);
