/**
 * Admin Hub — Recent Members (newest signups from users.json).
 * PIN-gated via hub apiGet / apiPost. Expired locker rows can get +30 days + email.
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
        year: 'numeric',
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

  function billingLabel(row) {
    var src = String(row.billingSource || '').toLowerCase();
    if (src === 'apple' || src === 'app_store' || src === 'iap') return 'Apple';
    if (src === 'stripe') return 'Stripe';
    if (src === 'manual' || src === 'admin') return 'Manual';
    if (row.hasStripe) return 'Stripe';
    return '—';
  }

  function sourceLabel(row) {
    var src = String(row.source || '').trim().toLowerCase();
    if (!src || src === 'direct') return 'direct';
    return src;
  }

  function sourceDetail(row) {
    var parts = [];
    if (row.medium) parts.push(String(row.medium));
    if (row.campaign) parts.push(String(row.campaign));
    return parts.length ? parts.join(' · ') : '';
  }

  function renderBySource(bySource) {
    var rows = Array.isArray(bySource) ? bySource : [];
    if (!rows.length) return 'Outlets: no attributed signups in this window (direct/unknown until tracked links are used)';
    return 'Outlets: ' + rows.slice(0, 8).map(function (r) {
      return String(r.source || 'direct') + ' ' + String(r.count || 0);
    }).join(' · ');
  }

  function renderByChannel(byChannel) {
    var rows = Array.isArray(byChannel) ? byChannel : [];
    if (!rows.length) return 'Channel: none in this window';
    var labels = { website: 'Website', ios: 'iOS app', unknown: 'Unknown' };
    return 'Channel: ' + rows.map(function (r) {
      var key = String(r.channel || 'unknown');
      return (labels[key] || key) + ' ' + String(r.count || 0);
    }).join(' · ');
  }

  function channelLabel(row) {
    var ch = String(row.signupChannel || 'unknown').toLowerCase();
    if (ch === 'website') return 'Website';
    if (ch === 'ios') return 'iOS app';
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
    var apiPost = ctx.apiPost;
    var onNavigate = ctx.onNavigate || function () {};
    var state = { since: '30d', access: 'all', limit: 50, lastMembers: [] };

    container.innerHTML =
      '<div class="hub-sum hub-members">'
      + '<div class="hub-dash-head">'
      + '<div><h2 class="hub-dash-title">Recent Members</h2>'
      + '<p class="hub-dash-sub">Newest signups from the durable account store — trial, paid, expired, and first-touch outlet</p></div>'
      + '<div class="hub-btn-row">'
      + '<button type="button" class="hub-btn secondary" id="hub-mem-refresh">Refresh</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-mem-points">Member Points</button>'
      + '</div></div>'
      + '<div class="hub-mem-toolbar">'
      + '<div class="hub-mem-filters" role="group" aria-label="Time window">'
      + '<button type="button" class="hub-mem-chip active" data-since="7d">7 days</button>'
      + '<button type="button" class="hub-mem-chip" data-since="30d">30 days</button>'
      + '<button type="button" class="hub-mem-chip" data-since="90d">90 days</button>'
      + '<button type="button" class="hub-mem-chip" data-since="all">All</button>'
      + '</div>'
      + '<div class="hub-mem-filters" role="group" aria-label="Access filter">'
      + '<button type="button" class="hub-mem-chip active" data-access="all">All</button>'
      + '<button type="button" class="hub-mem-chip" data-access="trial">Trial</button>'
      + '<button type="button" class="hub-mem-chip" data-access="paid">Paid</button>'
      + '<button type="button" class="hub-mem-chip" data-access="expired">Expired</button>'
      + '</div>'
      + '<div class="hub-btn-row" style="margin-top:10px">'
      + '<button type="button" class="hub-btn" id="hub-mem-extend-visible">Extend visible expired +30d</button>'
      + '<button type="button" class="hub-btn secondary" id="hub-mem-announce-129">Send 1.0.29 Chase email</button>'
      + '</div>'
      + '</div>'
      + '<div id="hub-mem-counts" class="hub-mem-counts hub-meta"></div>'
      + '<div id="hub-mem-loading" class="hub-dash-loading">Loading members…</div>'
      + '<div id="hub-mem-body" class="hidden"></div>'
      + '<p id="hub-mem-msg" class="hub-meta" style="margin-top:12px"></p>'
      + '</div>';

    var loading = document.getElementById('hub-mem-loading');
    var body = document.getElementById('hub-mem-body');
    var msg = document.getElementById('hub-mem-msg');
    var countsEl = document.getElementById('hub-mem-counts');

    document.getElementById('hub-mem-refresh').addEventListener('click', load);
    document.getElementById('hub-mem-points').addEventListener('click', function () {
      onNavigate('#settings/platform');
    });
    document.getElementById('hub-mem-extend-visible').addEventListener('click', function () {
      var emails = (state.lastMembers || [])
        .filter(function (m) { return m && m.access === 'expired' && m.email; })
        .map(function (m) { return m.email; });
      extendEmails(emails, 'visible expired');
    });
    document.getElementById('hub-mem-announce-129').addEventListener('click', function () {
      if (!apiPost) {
        setMsg('Announce is not wired in this hub build', true);
        return;
      }
      if (!window.confirm('Email all active members and trials about 1.0.29 and how to read 2028 Chase / Closest? Expired locker is skipped. People who already got this letter will not get it again.')) {
        return;
      }
      setMsg('Sending 1.0.29 Chase email…');
      apiPost('/api/admin/members/announce-ios-129', { dryRun: false })
        .then(function (payload) {
          var sent = payload && payload.sent != null ? payload.sent : 0;
          var queued = payload && payload.queued != null ? payload.queued : 0;
          var failed = payload && payload.failed != null ? payload.failed : 0;
          var skipped = payload && payload.skippedCount != null ? payload.skippedCount : 0;
          setMsg('1.0.29 Chase email · sent ' + sent + ' of ' + queued + ' · failed ' + failed + ' · skipped ' + skipped);
        })
        .catch(function (e) {
          setMsg((e && e.message) || '1.0.29 Chase email failed', true);
        });
    });

    container.querySelectorAll('[data-since]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.since = btn.getAttribute('data-since') || '30d';
        container.querySelectorAll('[data-since]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        load();
      });
    });

    container.querySelectorAll('[data-access]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.access = btn.getAttribute('data-access') || 'all';
        container.querySelectorAll('[data-access]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        load();
      });
    });

    // Default chip highlight for 30d
    container.querySelectorAll('[data-since]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-since') === state.since);
    });

    function setMsg(text, isErr) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.style.color = isErr ? '#fca5a5' : '';
    }

    function extendEmails(emails, label) {
      if (!apiPost) {
        setMsg('Extend is not wired in this hub build', true);
        return Promise.resolve();
      }
      var list = (emails || []).filter(Boolean);
      if (!list.length) {
        setMsg('No expired locker emails to extend');
        return Promise.resolve();
      }
      if (!window.confirm('Give ' + list.length + ' expired locker ' + (list.length === 1 ? 'account' : 'accounts') + ' 30 more days and email them? Test/demo addresses are skipped.')) {
        return Promise.resolve();
      }
      setMsg('Extending ' + (label || list.length + ' accounts') + '…');
      return apiPost('/api/admin/members/extend-trial', {
        emails: list,
        days: 30,
        sendEmail: true,
        dryRun: false
      })
        .then(function (payload) {
          var extended = payload && payload.extended != null ? payload.extended : 0;
          var emailed = payload && payload.emailed != null ? payload.emailed : 0;
          var skipped = payload && payload.skipped != null ? payload.skipped : 0;
          setMsg('Extended ' + extended + ' · emailed ' + emailed + ' · skipped ' + skipped);
          return load();
        })
        .catch(function (e) {
          setMsg((e && e.message) || 'Extend failed', true);
        });
    }

    function renderTable(payload) {
      var members = payload.members || [];
      state.lastMembers = members;
      var counts = payload.counts || {};
      if (countsEl) {
        countsEl.innerHTML =
          '<div>Showing ' + esc(payload.returned || members.length) + ' of ' + esc(payload.total || 0)
          + ' · Trial ' + esc(counts.trial || 0)
          + ' · Paid ' + esc(counts.paid || 0)
          + ' · Expired ' + esc(counts.expired || 0) + '</div>'
          + '<div style="margin-top:6px">' + esc(renderByChannel(payload.byChannel)) + '</div>'
          + '<div style="margin-top:6px">' + esc(renderBySource(payload.bySource)) + '</div>';
      }

      if (!members.length) {
        body.innerHTML = '<p class="hub-meta">No members in this window.</p>';
        return;
      }

      var rows = members.map(function (m) {
        var email = m.email || '';
        var detail = sourceDetail(m);
        return '<tr>'
          + '<td><div class="hub-mem-name">' + esc(m.name || '—') + '</div>'
          + '<div class="hub-mem-email">' + esc(email || '—') + '</div></td>'
          + '<td>' + esc(fmtWhen(m.createdAt)) + '</td>'
          + '<td><span class="' + accessClass(m.access) + '">' + esc(accessLabel(m.access)) + '</span></td>'
          + '<td>' + esc(m.tier || '—') + '</td>'
          + '<td>' + esc(channelLabel(m)) + '</td>'
          + '<td><div>' + esc(sourceLabel(m)) + '</div>'
          + (detail ? '<div class="hub-mem-email">' + esc(detail) + '</div>' : '')
          + '</td>'
          + '<td>' + esc(billingLabel(m)) + '</td>'
          + '<td>' + esc(m.trialEnd ? fmtWhen(m.trialEnd) : '—') + '</td>'
          + '<td><button type="button" class="hub-btn secondary hub-mem-copy" data-email="' + esc(email) + '"'
          + (email ? '' : ' disabled') + '>Copy</button>'
          + (m.access === 'expired' && email
            ? ' <button type="button" class="hub-btn secondary hub-mem-extend" data-email="' + esc(email) + '">+30d</button>'
            : '')
          + '</td>'
          + '</tr>';
      }).join('');

      body.innerHTML =
        '<div class="hub-table-wrap">'
        + '<table class="hub-table" aria-label="Recent members">'
        + '<thead><tr>'
        + '<th>Member</th><th>Joined</th><th>Access</th><th>Tier</th><th>Channel</th><th>Source</th><th>Billing</th><th>Trial end</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

      body.querySelectorAll('.hub-mem-copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var email = btn.getAttribute('data-email') || '';
          copyText(email)
            .then(function () { setMsg('Copied ' + email); })
            .catch(function () { setMsg('Copy failed', true); });
        });
      });
      body.querySelectorAll('.hub-mem-extend').forEach(function (btn) {
        btn.addEventListener('click', function () {
          extendEmails([btn.getAttribute('data-email') || ''], 'this account');
        });
      });
    }

    function load() {
      loading.classList.remove('hidden');
      body.classList.add('hidden');
      setMsg('');
      var qs =
        '?limit=' + encodeURIComponent(String(state.limit))
        + '&since=' + encodeURIComponent(state.since)
        + '&access=' + encodeURIComponent(state.access);
      return apiGet('/api/admin/members/recent' + qs)
        .then(function (payload) {
          renderTable(payload || {});
          loading.classList.add('hidden');
          body.classList.remove('hidden');
        })
        .catch(function (e) {
          loading.classList.add('hidden');
          body.classList.remove('hidden');
          body.innerHTML = '';
          setMsg((e && e.message) || 'Failed to load members', true);
        });
    }

    load();
  }

  global.GVAdminMembers = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
