/**
 * Admin Hub — Member Activity (last-seen + short page trail).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtWhen(iso) {
    if (!iso) return '—';
    try {
      var dt = new Date(iso);
      if (!Number.isFinite(dt.getTime())) return String(iso);
      return dt.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return String(iso);
    }
  }

  function accessLabel(access) {
    if (access === 'paid') return 'Paid';
    if (access === 'trial') return 'Trial';
    if (access === 'expired') return 'Expired';
    return access || '—';
  }

  function accessClass(access) {
    if (access === 'paid') return 'hub-mem-badge hub-mem-badge--paid';
    if (access === 'trial') return 'hub-mem-badge hub-mem-badge--trial';
    if (access === 'expired') return 'hub-mem-badge hub-mem-badge--expired';
    return 'hub-mem-badge';
  }

  function clientLabel(client) {
    if (client === 'ios') return 'iOS';
    if (client === 'website') return 'Website';
    return 'Unknown';
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('Nothing to copy'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function render(container, ctx) {
    var apiGet = ctx.apiGet;
    var onNavigate = ctx.onNavigate || function () {};
    var state = { hours: 24, staff: false };

    container.innerHTML =
      '<div class="hub-sum hub-members">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Member Activity</h2>'
      + '<p class="hub-dash-sub">Who opened the vault, on iOS vs website, and which pages they hit. Last-seen stamps on sign-in and app open. Page trail fills in on the website now; iOS page trail needs the next App Store bake.</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-act-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-act-roster">Recent Members</button>'
      + '</div></div>'
      + '<div class="hub-mem-toolbar">'
      + '<div class="hub-mem-filters" role="group" aria-label="Time window">'
      + '<button type="button" class="hub-mem-chip active" data-hours="24">24 hours</button>'
      + '<button type="button" class="hub-mem-chip" data-hours="168">7 days</button>'
      + '</div>'
      + '<div class="hub-mem-filters" role="group" aria-label="Staff filter">'
      + '<button type="button" class="hub-mem-chip active" data-staff="0">Hide staff</button>'
      + '<button type="button" class="hub-mem-chip" data-staff="1">Show staff</button>'
      + '</div>'
      + '</div>'
      + '<div id="hub-act-counts" class="hub-mem-counts hub-meta"></div>'
      + '<div id="hub-act-loading" class="hub-dash-loading">Loading activity…</div>'
      + '<div id="hub-act-body" class="hidden"></div>'
      + '<p id="hub-act-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-act-loading');
    var body = document.getElementById('hub-act-body');
    var msg = document.getElementById('hub-act-msg');
    var countsEl = document.getElementById('hub-act-counts');

    document.getElementById('hub-act-refresh').addEventListener('click', load);
    document.getElementById('hub-act-roster').addEventListener('click', function () {
      onNavigate('#members/recent');
    });

    container.querySelectorAll('[data-hours]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.hours = parseInt(btn.getAttribute('data-hours') || '24', 10) || 24;
        container.querySelectorAll('[data-hours]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        load();
      });
    });

    container.querySelectorAll('[data-staff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.staff = btn.getAttribute('data-staff') === '1';
        container.querySelectorAll('[data-staff]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        load();
      });
    });

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function renderTable(payload) {
      var members = payload.members || [];
      var counts = payload.counts || {};
      var top = payload.topPages || [];
      var topLine = top.length
        ? 'Top pages: ' + top.slice(0, 6).map(function (p) {
          return (p.label || p.path) + ' ' + String(p.count || 0);
        }).join(' · ')
        : 'Top pages: none yet';

      if (countsEl) {
        countsEl.innerHTML =
          '<div>Active ' + esc(counts.active || 0)
          + ' · iOS ' + esc(counts.ios || 0)
          + ' · Website ' + esc(counts.website || 0)
          + (counts.unknown ? ' · Unknown ' + esc(counts.unknown) : '')
          + '</div>'
          + '<div style="margin-top:6px">' + esc(topLine) + '</div>';
      }

      if (!members.length) {
        body.innerHTML =
          '<p class="hub-meta">No member activity in this window yet. Last-seen starts the next time someone signs in or opens the vault. Page-by-page trail fills in as they move around on the website.</p>';
        return;
      }

      var rows = members.map(function (m) {
        var email = m.email || '';
        var trail = (m.trail || []).slice(0, 5).map(function (hit) {
          return '<span class="hub-act-chip">' + esc(hit.label || hit.path) + '</span>';
        }).join('');
        return '<tr>'
          + '<td><div class="hub-mem-name">' + esc(m.name || '—') + '</div>'
          + '<div class="hub-mem-email">' + esc(email || '—') + '</div></td>'
          + '<td>' + esc(fmtWhen(m.lastSeenAt)) + '</td>'
          + '<td>' + esc(clientLabel(m.lastClient)) + '</td>'
          + '<td><span class="' + accessClass(m.access) + '">' + esc(accessLabel(m.access)) + '</span></td>'
          + '<td>' + esc(m.lastPathLabel || m.lastPath || '—') + '</td>'
          + '<td><div class="hub-act-trail">' + (trail || '<span class="hub-mem-email">—</span>') + '</div></td>'
          + '<td><button type="button" class="hub-btn secondary hub-mem-copy" data-email="' + esc(email) + '"'
          + (email ? '' : ' disabled') + '>Copy</button></td>'
          + '</tr>';
      }).join('');

      body.innerHTML =
        '<div class="hub-table-wrap">'
        + '<table class="hub-table" aria-label="Member activity">'
        + '<thead><tr>'
        + '<th>Member</th><th>Last seen</th><th>Client</th><th>Access</th><th>Last page</th><th>Trail</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

      body.querySelectorAll('.hub-mem-copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var email = btn.getAttribute('data-email') || '';
          copyText(email)
            .then(function () { setMsg('Copied ' + email); })
            .catch(function () { setMsg('Copy failed', true); });
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      var qs =
        '?hours=' + encodeURIComponent(String(state.hours))
        + '&staff=' + encodeURIComponent(state.staff ? '1' : '0')
        + '&limit=80';
      return apiGet('/api/admin/members/activity' + qs)
        .then(function (payload) {
          renderTable(payload || {});
          loading.classList.add('hidden');
          body.classList.remove('hidden');
        })
        .catch(function (e) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML = '';
          setMsg((e && e.message) || 'Failed to load activity', true);
        });
    }

    load();
  }

  global.GVAdminMembersActivity = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
