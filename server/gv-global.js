/**
 * GatorVault site-wide UI: live feed ticker + top alert banner.
 * Included on index.html, player.html, and other public pages.
 */
(function (global) {
  'use strict';

  var API =
    global.GV_API_BASE ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://gatorvault-api.onrender.com');

  var _tickerItems = [];
  var _tickerTimer = null;
  var _bannerTimer = null;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function typeLabel(t) {
    var map = {
      breaking: 'BREAKING',
      commit: 'COMMIT',
      portal: 'PORTAL',
      portal_in: 'PORTAL',
      article: 'ARTICLE',
      score: 'SCORE',
      thread: 'COMMUNITY',
      scouting: 'SCOUTING',
      offers: 'OFFERS',
      update: 'UPDATE'
    };
    return map[t] || String(t || 'UPDATE').toUpperCase();
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
    return Math.floor(ms / 86400000) + 'd ago';
  }

  function filterFeed(items) {
    return (items || []).filter(function (item) {
      if (!item || !item.title) return false;
      var t = String(item.type || '').toLowerCase();
      if (t === 'system' || t === 'ingest') return false;
      return true;
    });
  }

  function renderSiteTicker(items) {
    var bar = document.getElementById('gv-site-ticker');
    var track = document.getElementById('gv-site-ticker-track');
    if (!bar || !track) return;
    var top = filterFeed(items).slice(0, 14);
    _tickerItems = top;
    if (!top.length) {
      bar.classList.add('gv-site-ticker--empty');
      track.innerHTML =
        '<span class="gv-site-ticker-item"><strong class="text-gator-orange">GATORVAULT</strong> Live feed loading…</span>';
      return;
    }
    bar.classList.remove('gv-site-ticker--empty');
    var chunk = '';
    top.forEach(function (item) {
      chunk +=
        '<span class="gv-site-ticker-item"><strong class="text-gator-orange">' +
        esc(typeLabel(item.type)) +
        '</strong> ' +
        esc(item.title) +
        ' <span class="gv-ticker-muted">· ' +
        esc(timeAgo(item.createdAt)) +
        '</span></span>';
    });
    track.innerHTML = chunk + chunk;
  }

  function fetchTicker() {
    return fetch(API + '/api/live/dashboard?limit=40')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.ok && j.feed) renderSiteTicker(j.feed);
      })
      .catch(function () {});
  }

  function initSiteTicker() {
    document.body.classList.add('gv-has-site-ticker');
    var closeBtn = document.getElementById('gv-alert-banner-close');
    if (closeBtn && !closeBtn._gvWired) {
      closeBtn._gvWired = true;
      closeBtn.addEventListener('click', function () {
        hideAlertBanner();
        document.body.classList.remove('gv-has-alert-banner');
      });
    }
    fetchTicker();
    if (_tickerTimer) clearInterval(_tickerTimer);
    _tickerTimer = setInterval(fetchTicker, 60000);
  }

  function bannerIcon(type) {
    if (type === 'commit') return '🔁';
    if (type === 'portal' || type === 'portal_in') return '🔄';
    if (type === 'breaking') return '🚨';
    if (type === 'scouting') return '⚔️';
    if (type === 'score') return '🏟️';
    if (type === 'article') return '📰';
    return '🔔';
  }

  function hideAlertBanner() {
    var bar = document.getElementById('gv-alert-banner');
    if (!bar) return;
    bar.classList.remove('gv-alert-banner--visible');
    if (_bannerTimer) {
      clearTimeout(_bannerTimer);
      _bannerTimer = null;
    }
  }

  function showAlertBanner(title, body, type, ttl) {
    var bar = document.getElementById('gv-alert-banner');
    if (!bar) return;
    var icon = document.getElementById('gv-alert-banner-icon');
    var titleEl = document.getElementById('gv-alert-banner-title');
    var bodyEl = document.getElementById('gv-alert-banner-body');
    if (icon) icon.textContent = bannerIcon(type);
    if (titleEl) titleEl.textContent = title || 'GatorVault Alert';
    if (bodyEl) bodyEl.innerHTML = body || '';
    bar.className = 'gv-alert-banner gv-alert-banner--' + (type || 'update');
    bar.classList.add('gv-alert-banner--visible');
    document.body.classList.add('gv-has-alert-banner');
    if (_bannerTimer) clearTimeout(_bannerTimer);
    _bannerTimer = setTimeout(function () {
      hideAlertBanner();
      document.body.classList.remove('gv-has-alert-banner');
    }, ttl || 8000);
  }

  function showToastSecondary(title, body, ttl) {
    var c = document.getElementById('gv-toast-secondary');
    if (!c) {
      c = document.createElement('div');
      c.id = 'gv-toast-secondary';
      c.className = 'gv-toast-secondary';
      document.body.appendChild(c);
    }
    var el = document.createElement('div');
    el.className = 'gv-toast-secondary-item';
    el.innerHTML =
      '<div class="gv-toast-secondary-title">' +
      esc(title) +
      '</div>' +
      (body ? '<div class="gv-toast-secondary-body">' + esc(body) + '</div>' : '');
    c.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, ttl || 3500);
  }

  global.GV_GLOBAL = {
    initSiteTicker: initSiteTicker,
    renderSiteTicker: renderSiteTicker,
    fetchTicker: fetchTicker,
    showAlertBanner: showAlertBanner,
    hideAlertBanner: hideAlertBanner,
    showToastSecondary: showToastSecondary,
    esc: esc,
    typeLabel: typeLabel,
    timeAgo: timeAgo
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteTicker);
  } else {
    initSiteTicker();
  }
})(window);
