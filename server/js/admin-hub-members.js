/**
 * Admin Hub — Members / recent signups list.
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return String(iso);
    }
  }

  function accessClass(access) {
    if (access === 'paid') return 'hub-st-green';
    if (access === 'trial') return 'hub-st-yellow';
    if (access === 'trial_expired') return 'hub-st-red';
    return 'hub-st-unknown';
  }

  function accessLabel(access) {
    if (access === 'paid') return 'Paid';
    if (access === 'trial') return 'Trial';
    if (access === 'trial_expired') return 'Trial ended';
    return access || 'Member';
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var query = '';

    container.innerHTML =
      '<div class="hub-sum">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Members</h2>'
      + '<p class="hub-dash-sub">Who signed up — newest first. Passwords never shown.</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-members-refresh">Refresh</button>'
      + '</div></div>'
      + '<div class="hub-btn-row" style="margin:12px 0;gap:8px;flex-wrap:wrap">'
      + '<input id="hub-members-q" type="search" placeholder="Search name or email" '
      + 'style="flex:1;min-width:180px;padding:10px 12px;border-radius:8px;border:1px solid rgba(148,163,184,.35);'
      + 'background:rgba(15,23,42,.55);color:#e2e8f0" />'
      + '<button type="button" class="hub-btn" id="hub-members-search">Search</button>'
      + '</div>'
      + '<div id="hub-members-loading" class="hub-dash-loading">Loading members…</div>'
      + '<div id="hub-members-body" class="hidden"></div>'
      + '<p id="hub-members-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-members-loading');
    var body = document.getElementById('hub-members-body');
    var msg = document.getElementById('hub-members-msg');
    var qInput = document.getElementById('hub-members-q');

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function paint(data) {
      var members = data.members || [];
      var total = data.total != null ? data.total : members.length;
      var notifyOk = !!data.notifyEmailConfigured;
      var rows = members.map(function (m) {
        return '<tr>'
          + '<td><strong style="color:#fff">' + esc(m.name || '—') + '</strong><div class="hub-meta">' + esc(m.email) + '</div></td>'
          + '<td><span class="hub-env-badge ' + accessClass(m.access) + '">' + esc(accessLabel(m.access)) + '</span></td>'
          + '<td>' + esc(fmtTime(m.createdAt)) + '</td>'
          + '<td>' + esc(m.trialEnd ? fmtTime(m.trialEnd) : '—') + '</td>'
          + '<td>' + esc(m.onboardingSent ? 'Welcome sent' : '—') + '</td>'
          + '</tr>';
      }).join('') || '<tr><td colspan="5" class="hub-meta">No members match.</td></tr>';

      body.innerHTML =
        '<div class="hub-dash-grid">'
        + '<section class="hub-card hub-card-wide ' + (total > 0 ? 'hub-st-green' : 'hub-st-unknown') + '">'
        + '<div class="hub-dash-hero">'
        + '<div><span class="hub-overall-label">Total accounts</span>'
        + '<strong class="hub-overall-val">' + esc(String(total)) + '</strong>'
        + '<p class="hub-dash-ts" style="margin-top:8px">Showing ' + esc(String(members.length))
        + (query ? ' matching “' + esc(query) + '”' : ' most recent') + '</p></div>'
        + '<div>'
        + '<p class="hub-meta" style="margin:0 0 6px">Signup email alerts: <strong style="color:#fff">'
        + (notifyOk ? 'ON' : 'OFF') + '</strong></p>'
        + '<p class="hub-meta" style="margin:0">' + esc(data.notifyEmailHint || '') + '</p>'
        + '</div></div></section>'
        + '<section class="hub-card hub-card-wide">'
        + '<h3 class="hub-card-title">Recent signups</h3>'
        + '<div style="overflow-x:auto">'
        + '<table class="hub-table" style="width:100%;border-collapse:collapse">'
        + '<thead><tr>'
        + '<th style="text-align:left;padding:8px 6px">Member</th>'
        + '<th style="text-align:left;padding:8px 6px">Access</th>'
        + '<th style="text-align:left;padding:8px 6px">Signed up</th>'
        + '<th style="text-align:left;padding:8px 6px">Trial ends</th>'
        + '<th style="text-align:left;padding:8px 6px">Onboarding</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div></section></div>';
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      var path = '/api/admin/hub/members?limit=100';
      if (query) path += '&q=' + encodeURIComponent(query);
      return apiGet(path)
        .then(function (data) {
          paint(data || {});
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          if (global.GVAdminHub && typeof global.GVAdminHub.pushActivity === 'function') {
            global.GVAdminHub.pushActivity({
              status: 'success',
              message: 'Loaded ' + ((data && data.members && data.members.length) || 0) + ' members',
              subsystem: 'members'
            });
          }
        })
        .catch(function (e) {
          loading.classList.add('hidden');
          body.classList.add('hidden');
          setMsg(e.message || 'Failed to load members', true);
        });
    }

    document.getElementById('hub-members-refresh').addEventListener('click', function () {
      query = String(qInput.value || '').trim();
      load();
    });
    document.getElementById('hub-members-search').addEventListener('click', function () {
      query = String(qInput.value || '').trim();
      load();
    });
    qInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        query = String(qInput.value || '').trim();
        load();
      }
    });

    load();
  }

  global.GVAdminMembersSummary = { render: render };
})(window);
