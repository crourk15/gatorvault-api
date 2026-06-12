(function () {
  'use strict';

  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000' : '';

  var TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'high-school', label: 'High School', key: 'highSchoolProfile' },
    { id: 'college', label: 'College', key: 'collegeProfile' },
    { id: 'portal', label: 'Portal', key: 'portalProfile' },
    { id: 'uf-fit', label: 'UF Fit', key: 'ufSpecificProfile' },
    { id: 'signals', label: 'Signals' }
  ];

  var SIGNAL_WEIGHTS = { OFFER: 10, RANKING_JUMP: 15, CAMP_PERFORMANCE: 20, EVALUATION_NOTE: 10, SOCIAL_MOMENTUM: 5, PORTAL_ACTIVITY: 25, STAFF_FLAG: 30, OTHER: 5 };
  var UF_STATUS_INTEREST = { TARGET: 5, PRIORITY: 8, EVAL: 3, COMMITTED: 10, NOT_INTERESTED: 0 };
  var LIFECYCLE_COLORS = { HS: '#38bdf8', COLLEGE: '#fb923c', PORTAL: '#c4b5fd' };

  var state = { data: null, tab: 'overview', metrics: null, portalIntel: null, portalPredictions: [], ufFitIntel: null, playerPredictions: [] };

  function slugFromPath() {
    var m = location.pathname.match(/\/futurecast\/player\/([^/]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fetchJson(path) {
    return fetch(API + path).then(function (r) {
      if (!r.ok) return r.json().then(function (b) { throw new Error(b.error || 'Request failed'); });
      return r.json();
    });
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function clamp100(n) { return clamp(n, 0, 100); }
  function clamp01(n) { return clamp(n, 0, 1); }

  function formatHeight(inches) {
    if (inches == null) return '—';
    return Math.floor(inches / 12) + "'" + Math.round(inches % 12) + '"';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fitTier(score) {
    if (score >= 85) return 'elite';
    if (score >= 70) return 'strong';
    if (score >= 50) return 'moderate';
    return 'low';
  }

  function fitTierLabel(t) {
    return { elite: 'Elite', strong: 'Strong', moderate: 'Moderate', low: 'Low' }[t] || t;
  }

  function portalColor(pct) {
    if (pct >= 70) return 'high';
    if (pct >= 40) return 'medium';
    return 'low';
  }

  function computeUfFit(uf) {
    if (!uf) return 0;
    if (uf.ufFitScore != null) return clamp100(uf.ufFitScore);
    var scheme = ((uf.schemeScore || 0) / 100) * 40;
    var culture = ((uf.characterScore || 0) / 100) * 30;
    var positional = ((uf.athleticScore || uf.timelineScore || 0) / 100) * 20;
    var staff = ((UF_STATUS_INTEREST[uf.ufStatus || ''] || 0) / 10) * 10;
    return clamp100(scheme + culture + positional + staff);
  }

  function computePortalLikelihood(player, portal, college, signals) {
    if (player.status === 'PORTAL') return 1;
    if (player.status === 'HS') return 0;
    var types = signals.map(function (x) { return x.signalType; });
    var score = 0.05;
    if (types.indexOf('PORTAL_ACTIVITY') >= 0) score += 0.25;
    if (types.indexOf('SOCIAL_MOMENTUM') >= 0) score += 0.15;
    if (types.indexOf('STAFF_FLAG') >= 0) score += 0.1;
    if (types.indexOf('EVALUATION_NOTE') >= 0) score += 0.05;
    return clamp01(score);
  }

  function signalWeight(t) { return SIGNAL_WEIGHTS[t] || SIGNAL_WEIGHTS.OTHER; }

  function formatSignalValue(s) {
    var v = s.signalValue || {};
    if (v.school) return String(v.school);
    if (v.note) return String(v.note);
    return Object.keys(v).map(function (k) { return k + ': ' + v[k]; }).join(' · ') || '—';
  }

  function dlRow(label, value) {
    return value != null && value !== '' && value !== '—'
      ? '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>' : '';
  }

  function section(title, inner) {
    return '<section class="fc-profile-section"><h2>' + esc(title) + '</h2>' + inner + '</section>';
  }

  function loadProfile(slug) {
    return fetchJson('/api/players/slug/' + encodeURIComponent(slug)).then(function (slugRes) {
      var id = slugRes.player.id;
      return Promise.all([
        Promise.resolve(slugRes.player),
        fetchJson('/api/players/' + id + '/profiles'),
        fetchJson('/api/players/' + id + '/signals?limit=100'),
        fetchJson('/api/players/' + id + '/related?limit=6')
      ]).then(function (parts) {
        return {
          player: parts[0],
          highSchoolProfile: parts[1].highSchoolProfile,
          collegeProfile: parts[1].collegeProfile,
          portalProfile: parts[1].portalProfile,
          ufSpecificProfile: parts[1].ufSpecificProfile,
          signals: parts[2].signals || [],
          related: parts[3].players || []
        };
      });
    });
  }

  function renderHeader(data, metrics) {
    var p = data.player;
    var portal = data.portalProfile;
    var loc = [p.hometown, p.state].filter(Boolean).join(', ');
    var lc = LIFECYCLE_COLORS[p.status] || '#94a3b8';
    var pc = portalColor(metrics.portalPct);

    return (
      '<header class="fc-profile-header">' +
        '<div class="fc-profile-header__top">' +
          '<div>' +
            '<p class="fc-profile-header__position">' + esc(p.position) + ' · Class of ' + p.classYear + '</p>' +
            '<h1 class="fc-profile-header__name">' + esc(p.fullName) + '</h1>' +
            (loc ? '<p class="fc-profile-header__location">' + esc(loc) + '</p>' : '') +
            ((p.height || p.weight) ? '<p class="fc-profile-header__measurables">' + formatHeight(p.height) + ' · ' + (p.weight ? p.weight + ' lbs' : '—') + '</p>' : '') +
          '</div>' +
          '<button type="button" class="fc-profile-share" id="share-btn">Share</button>' +
        '</div>' +
        '<div class="fc-profile-header__badges">' +
          '<span class="fc-profile-lifecycle" style="border-color:' + lc + ';color:' + lc + '">' + esc(p.status) + '</span>' +
          (portal && portal.portalStatus ? '<span class="fc-profile-portal-status">' + esc(portal.portalStatus.replace(/_/g, ' ')) + '</span>' : '') +
          (p.stars != null ? '<span class="fc-profile-stars">' + p.stars + '★</span>' : '') +
          (p.committedTo ? '<span class="fc-profile-commit">Committed: ' + esc(p.committedTo) + '</span>' : '') +
        '</div>' +
        '<div class="fc-profile-header__scores">' +
          '<div class="fc-score-card fc-score-card--' + metrics.ufTier + '"><span class="fc-score-card__label">UF Fit Score™</span><span class="fc-score-card__value">' + metrics.ufScore + '</span><span class="fc-score-card__tier">' + fitTierLabel(metrics.ufTier) + '</span></div>' +
          '<div class="fc-score-card fc-score-card--portal fc-score-card--portal-' + pc + '"><span class="fc-score-card__label">Portal Likelihood</span><span class="fc-score-card__value">' + metrics.portalPct + '%</span></div>' +
          '<div class="fc-score-card"><span class="fc-score-card__label">Signals</span><span class="fc-score-card__value">' + metrics.signalCount + '</span></div>' +
        '</div>' +
      '</header>'
    );
  }

  function renderTabs(active) {
    var html = '<nav class="fc-profile-tabs" role="tablist">';
    TABS.forEach(function (tab) {
      var disabled = tab.key && !state.data[tab.key];
      if (tab.id === 'portal' && (state.data.player.status === 'COLLEGE' || state.data.player.status === 'PORTAL')) {
        disabled = false;
      }
      html += '<button type="button" role="tab" class="fc-profile-tab' + (active === tab.id ? ' is-active' : '') + (disabled ? ' is-disabled' : '') + '" data-tab="' + tab.id + '"' + (disabled ? ' disabled' : '') + '>' + tab.label + '</button>';
    });
    return html + '</nav>';
  }

  function renderOverview(data, metrics) {
    var p = data.player;
    var recent = data.signals.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
    var relatedHtml = data.related.filter(function (r) { return r.slug !== p.slug; }).map(function (r) {
      return '<a class="fc-related-card" href="/futurecast/player/' + encodeURIComponent(r.slug) + '"><span class="fc-related-card__rank">#' + r.rank + '</span><span class="fc-related-card__name">' + esc(r.fullName) + '</span><span class="fc-related-card__meta">' + esc(r.position) + ' · UF Fit ' + r.ufFitScore + '</span></a>';
    }).join('');

    var html = section('Identity', '<dl class="fc-profile-dl">' +
      dlRow('Position', p.position) + dlRow('Class', p.classYear) + dlRow('Lifecycle', p.status) +
      (data.collegeProfile ? dlRow('College', data.collegeProfile.college) : '') + '</dl>');

    html += section('Intelligence', '<div class="fc-profile-metrics-row"><div><strong>UF Fit Score™</strong><br>' + metrics.ufScore + '</div><div><strong>Portal Likelihood</strong><br>' + metrics.portalPct + '%</div><div><strong>Signals</strong><br>' + metrics.signalCount + '</div></div>');

    var preds = state.playerPredictions || [];
    if (preds.length) {
      html += section('FutureCast Picks', '<ul class="fc-prediction-list">' + preds.map(function (pr) {
        return '<li class="fc-prediction-item"><div><span class="fc-prediction-item__school">' + esc(pr.school) + '</span> ' +
          '<span class="fc-pred-source fc-pred-source--' + pr.sourceType.toLowerCase() + '">' + esc(pr.sourceType) + '</span> ' +
          '<span class="fc-pred-status fc-pred-status--' + pr.status.toLowerCase() + '">' + esc(pr.status) + '</span></div>' +
          '<div class="fc-prediction-item__bar-wrap"><div class="fc-prediction-item__bar" style="width:' + pr.confidence + '%"></div></div>' +
          '<span class="fc-prediction-item__score">' + pr.confidence + '%</span></li>';
      }).join('') + '</ul>');
    } else {
      html += section('FutureCast Picks', '<p class="fc-profile-muted">No FutureCast Picks on file yet.</p>');
    }

    if (recent.length) {
      html += section('Recent Signals', '<ul class="fc-signal-feed fc-signal-feed--compact">' + recent.map(function (s) {
        return '<li><span class="fc-signal-feed__type">' + esc(s.signalType.replace(/_/g, ' ')) + '</span> ' + esc(formatSignalValue(s)) + ' <span class="fc-signal-feed__meta">' + formatDate(s.createdAt) + '</span></li>';
      }).join('') + '</ul>');
    }

    if (relatedHtml) html += section('Related Players', '<div class="fc-related-grid">' + relatedHtml + '</div>');
    return html;
  }

  function renderHighSchool(data) {
    var hs = data.highSchoolProfile;
    var p = data.player;
    if (!hs) return '<p class="fc-profile-empty">No high school profile on file.</p>';
    var stats = hs.stats || {};
    var offers = (hs.offers || []).map(function (o) {
      return '<li><strong>' + esc(o.school || 'Unknown') + '</strong>' + (o.date ? ' · ' + esc(o.date) : '') + '</li>';
    }).join('');
    return (
      section('School & Location', '<dl class="fc-profile-dl">' +
        dlRow('High School', p.highSchool || stats.school) +
        dlRow('Location', [p.hometown, p.state].filter(Boolean).join(', ')) +
        dlRow('Height / Weight', formatHeight(p.height) + ' · ' + (p.weight ? p.weight + ' lbs' : '—')) + '</dl>') +
      section('Rankings', '<dl class="fc-profile-dl">' +
        dlRow('Stars', p.stars != null ? p.stars + '★' : null) +
        dlRow('National', p.rankingNational ? '#' + p.rankingNational : null) +
        dlRow('Position', p.rankingPosition ? '#' + p.rankingPosition : null) +
        dlRow('State', p.rankingState ? '#' + p.rankingState : null) + '</dl>') +
      (offers ? section('Offers', '<ul class="fc-offer-list">' + offers + '</ul>') : '') +
      (hs.recruitingNotes ? section('Recruiting Notes', '<p>' + esc(hs.recruitingNotes) + '</p>') : '')
    );
  }

  function renderCollege(data) {
    var cp = data.collegeProfile;
    if (!cp) return '<p class="fc-profile-empty">No college profile on file.</p>';
    var stats = cp.stats || {};
    var statRows = Object.keys(stats).slice(0, 12).map(function (k) {
      return dlRow(k.replace(/_/g, ' '), typeof stats[k] === 'object' ? JSON.stringify(stats[k]) : stats[k]);
    }).join('');
    return section('Program', '<dl class="fc-profile-dl">' +
      dlRow('College', cp.college) +
      dlRow('Years', cp.yearsPlayed) +
      dlRow('Games', cp.gamesPlayed) + '</dl>') +
      (statRows ? section('Stats', '<dl class="fc-profile-dl">' + statRows + '</dl>') : '');
  }

  function renderPortal(data, metrics) {
    var pp = data.portalProfile;
    var intel = state.portalIntel;
    var preds = state.portalPredictions || [];
    if (!pp && data.player.status !== 'COLLEGE' && data.player.status !== 'PORTAL') {
      return '<p class="fc-profile-empty">No portal intelligence on file.</p>';
    }
    var html = '';
    if (intel) {
      html += section('Portal Intelligence', '<dl class="fc-profile-dl">' +
        dlRow('Portal Likelihood', metrics.portalPct + '%') +
        dlRow('Depth Chart Risk', intel.depthChartRisk) +
        dlRow('Snap Share Score', intel.snapShareScore) +
        dlRow('Volatility Index', intel.volatility) + '</dl>');
    }
    if (pp) {
      html += section('Portal Status', '<dl class="fc-profile-dl">' +
        dlRow('Status', pp.portalStatus.replace(/_/g, ' ')) +
        dlRow('Previous', pp.previousSchool) +
        dlRow('Destination', pp.destinationSchool) +
        dlRow('Entered', formatDate(pp.enteredPortalAt)) +
        dlRow('Exited', formatDate(pp.exitedPortalAt)) + '</dl>');
    }
    html += section('Portal Likelihood', '<p class="fc-portal-likelihood-big">' + metrics.portalPct + '%</p>');
    if (preds.length) {
      html += section('Transfer Predictions', '<ul class="fc-offer-list">' + preds.map(function (p) {
        return '<li><strong>' + esc(p.school) + '</strong> — ' + Math.round(p.score * 100) + '%</li>';
      }).join('') + '</ul>');
    }
    if (pp && pp.reasonTags && pp.reasonTags.length) {
      html += section('Reason Tags', '<ul class="fc-reason-tags">' + pp.reasonTags.map(function (t) {
        return '<li class="fc-reason-tag">' + esc(t.replace(/_/g, ' ')) + '</li>';
      }).join('') + '</ul>');
    }
    return html;
  }

  function renderUfFit(data) {
    var uf = data.ufSpecificProfile;
    var intel = state.ufFitIntel;
    if (!uf && !intel) return '<p class="fc-profile-empty">No UF-specific profile on file.</p>';
    var total = intel ? intel.ufFitScore : computeUfFit(uf);
    var tier = intel ? intel.fitTier : fitTier(total);
    var scheme = intel ? intel.schemeFit : ((uf.schemeScore || 0) / 100) * 40;
    var culture = intel ? intel.cultureFit : ((uf.characterScore || 0) / 100) * 30;
    var positional = intel ? intel.positionalNeed : ((uf.athleticScore || uf.timelineScore || 0) / 100) * 20;
    var staff = intel ? intel.staffInterest : ((UF_STATUS_INTEREST[uf.ufStatus || ''] || 0) / 10) * 10;
    var delta = intel ? intel.fitDelta : 0;
    var vol = intel ? intel.fitVolatility : 0;

    function bar(label, val, max) {
      var pct = max ? (val / max) * 100 : 0;
      return '<div class="fc-uf-bar"><div class="fc-uf-bar__header"><span>' + label + '</span><span>' + val.toFixed(1) + ' / ' + max + '</span></div><div class="fc-uf-bar__track"><div class="fc-uf-bar__fill" style="width:' + pct + '%"></div></div></div>';
    }

    var html = section('UF Fit Score™', '<div class="fc-uf-total fc-uf-total--' + tier + '"><span class="fc-uf-total__score">' + total + '</span><span class="fc-uf-total__tier">' + fitTierLabel(tier) + '</span></div>' +
      '<p class="fc-profile-muted">Δ ' + (delta > 0 ? '+' : '') + delta + ' (30d) · Volatility ' + vol + '</p>');
    html += section('Component Breakdown', bar('Scheme Fit', scheme, 40) + bar('Culture Fit', culture, 30) + bar('Positional Need', positional, 20) + bar('Staff Interest', staff, 10));
    if (intel && intel.history && intel.history.length) {
      html += section('Fit History', '<ul class="fc-offer-list">' + intel.history.slice(-5).map(function (h) {
        return '<li>' + h.date + ': ' + h.score + '</li>';
      }).join('') + '</ul>');
    }
    if (uf && uf.evaluationNotes) html += section('Evaluation Notes', '<p>' + esc(uf.evaluationNotes) + '</p>');
    return html;
  }

  function renderSignals(data) {
    var signals = data.signals.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (!signals.length) return '<p class="fc-profile-empty">No discovery signals recorded.</p>';
    return '<ul class="fc-signal-feed">' + signals.map(function (s) {
      return '<li class="fc-signal-feed__item"><div class="fc-signal-feed__head"><span class="fc-signal-feed__type">' + esc(s.signalType.replace(/_/g, ' ')) + '</span><span class="fc-signal-feed__weight">Weight ' + signalWeight(s.signalType) + '</span></div><p class="fc-signal-feed__value">' + esc(formatSignalValue(s)) + '</p><time class="fc-signal-feed__meta">' + formatDate(s.createdAt) + '</time></li>';
    }).join('') + '</ul>';
  }

  function renderPanel() {
    var d = state.data;
    var m = state.metrics;
    switch (state.tab) {
      case 'overview': return renderOverview(d, m);
      case 'high-school': return renderHighSchool(d);
      case 'college': return renderCollege(d);
      case 'portal': return renderPortal(d, m);
      case 'uf-fit': return renderUfFit(d);
      case 'signals': return renderSignals(d);
      default: return '';
    }
  }

  function render() {
    var app = document.getElementById('app');
    if (!state.data) return;
    app.innerHTML = renderHeader(state.data, state.metrics) + renderTabs(state.tab) + '<div class="fc-profile-panel" role="tabpanel">' + renderPanel() + '</div>';

    document.getElementById('share-btn').addEventListener('click', function () {
      var url = location.origin + '/futurecast/player/' + encodeURIComponent(state.data.player.slug) + (state.tab !== 'overview' ? '?tab=' + state.tab : '');
      if (navigator.share) {
        navigator.share({ title: state.data.player.fullName, url: url });
      } else {
        navigator.clipboard.writeText(url).then(function () {
          document.getElementById('share-btn').textContent = 'Link copied!';
          setTimeout(function () { document.getElementById('share-btn').textContent = 'Share'; }, 2000);
        });
      }
    });

    app.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        state.tab = btn.getAttribute('data-tab');
        var url = new URL(location.href);
        if (state.tab === 'overview') url.searchParams.delete('tab');
        else url.searchParams.set('tab', state.tab);
        history.replaceState(null, '', url.toString());
        render();
      });
    });
  }

  function showError(msg) {
    document.getElementById('app').innerHTML = '<div class="fc-profile-error"><p>' + esc(msg) + '</p><p><a href="/futurecast/big-board">← Back to Big Board</a></p></div>';
  }

  var slug = slugFromPath();
  if (!slug) {
    showError('Invalid player slug');
    return;
  }

  state.tab = new URLSearchParams(location.search).get('tab') || 'overview';

  loadProfile(slug).then(function (data) {
    state.data = data;
    var portalPromise = Promise.resolve();
    var ufFitPromise = Promise.resolve();
    var predictionsPromise = fetch(API + '/api/predictions/player/' + data.player.id)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) { if (res) state.playerPredictions = res.predictions || []; });
    if (data.player.status === 'COLLEGE' || data.player.status === 'PORTAL' || data.portalProfile) {
      portalPromise = fetch(API + '/api/portal/predictions/' + data.player.id)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (res) {
            state.portalIntel = res.intel;
            state.portalPredictions = res.predictions || [];
          }
        });
    }
    if (data.ufSpecificProfile) {
      ufFitPromise = fetch(API + '/api/uf-fit/' + data.player.id)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) { if (res) state.ufFitIntel = res; });
    }
    return Promise.all([portalPromise, ufFitPromise, predictionsPromise]).then(function () {
      var portalPct = state.portalIntel
        ? Math.round(state.portalIntel.portalLikelihood * 100)
        : Math.round(computePortalLikelihood(data.player, data.portalProfile, data.collegeProfile, data.signals) * 100);
      var ufScore = state.ufFitIntel ? state.ufFitIntel.ufFitScore : computeUfFit(data.ufSpecificProfile);
      state.metrics = {
        ufScore: ufScore,
        ufTier: fitTier(ufScore),
        portalPct: portalPct,
        signalCount: data.signals.length
      };
      document.title = data.player.fullName + ' — FutureCast';
      render();
    });
  }).catch(function (err) {
    showError(err.message || 'Failed to load player');
  });
})();
