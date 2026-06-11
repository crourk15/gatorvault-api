/**
 * Product Intelligence — scoring engine (severity weights, module/page/feature scores).
 */
const SEVERITY_WEIGHTS = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 5,
  info: 0
};

const MODULE_WEIGHTS = {
  integrity: 0.28,
  pages: 0.22,
  'visual-integrity': 0.18,
  ux: 0.12,
  'mobile-behavior': 0.1,
  api: 0.05,
  browser: 0.03,
  content: 0.02
};

const QA_MODULES = ['api', 'content', 'integrity', 'pages', 'ux', 'browser', 'visual-integrity', 'mobile-behavior'];

const PAGE_CHECKS = {
  '/': {
    desktop: ['pages:home:desktop'],
    mobile: ['pages:home:mobile']
  },
  '/film-room': {
    score: [
      'pages:film-room-hooks',
      'integrity:film-sources',
      'integrity:filmroom-structure',
      'api:film-room-catalog',
      'visual-integrity:film-room-theme'
    ]
  },
  '/team': {
    score: [
      'pages:team-hooks',
      'ux:modal-zindex',
      'visual-integrity:team-overview-background',
      'visual-integrity:team-theme-tokens',
      'visual-integrity:component-variants',
      'visual-integrity:panel-clipping',
      'visual-integrity:layout-overflow',
      'integrity:team-history-structure',
      'integrity:missing-content',
      'integrity:panel-clipping',
      'integrity:layout-overflow',
      'integrity:wrong-background',
      'mobile-behavior:team-tab-theme',
      'mobile-behavior:navigation-back'
    ]
  },
  '/admin': {
    desktop: ['pages:admin-hub:desktop', 'visual-integrity:admin-theme'],
    mobile: ['pages:admin-hub:mobile', 'visual-integrity:admin-theme']
  },
  '/latest': {
    score: [
      'integrity:feed-dedup',
      'integrity:autoposter-dedup',
      'integrity:missing-content',
      'api:live-feed',
      'api:live-dashboard'
    ]
  }
};

const FEATURE_CHECKS = {
  team_modals: [
    'pages:team-hooks',
    'ux:modal-zindex',
    'ux:scroll-containers',
    'visual-integrity:team-overview-background',
    'visual-integrity:component-variants',
    'visual-integrity:panel-clipping',
    'visual-integrity:layout-overflow',
    'integrity:panel-clipping',
    'integrity:layout-overflow',
    'integrity:team-history-structure'
  ],
  film_verified_source_modal: [
    'pages:film-room-hooks',
    'ux:modal-zindex',
    'integrity:film-sources',
    'integrity:filmroom-structure',
    'visual-integrity:film-room-theme'
  ],
  latest_updates_feed: [
    'integrity:feed-dedup',
    'integrity:autoposter-dedup',
    'api:live-feed',
    'api:live-dashboard',
    'mobile-behavior:feed-freshness'
  ],
  mobile_navigation: ['mobile-behavior:navigation-back', 'ux:tap-targets'],
  admin_hub: ['pages:admin-hub:desktop', 'pages:admin-hub:mobile', 'visual-integrity:admin-theme'],
  qa_monitor: ['api:ping']
};

function inferSeverity(check) {
  const id = String(check.id || '');
  if (check.module === 'visual-integrity') {
    if (/cross-page|contamination/.test(id)) return 'critical';
    if (/panel-clipping|layout-overflow/.test(id)) return 'high';
    if (/team-overview|theme-token|css-linked/.test(id)) return 'high';
    return 'medium';
  }
  if (/feed-dedup|autoposter-dedup|film-sources|api:ping/.test(id)) return 'critical';
  if (/layout-overflow|panel-clipping|missing-content|team-history|filmroom-structure|wrong-background/.test(id)) {
    return 'high';
  }
  if (check.module === 'integrity') return 'high';
  if (check.module === 'api' && !check.pass) return 'high';
  if (check.module === 'pages') return 'high';
  if (check.module === 'mobile-behavior') {
    if (/stale-html|team-tab-theme|navigation-back/.test(id)) return 'high';
    return 'medium';
  }
  if (check.module === 'ux') return 'medium';
  if (check.module === 'browser') return 'medium';
  if (check.module === 'content') return 'low';
  return 'medium';
}

function inferImpact(check) {
  const id = String(check.id || '');
  if (check.module === 'visual-integrity') return 'user-facing';
  if (/layout-overflow|panel-clipping|missing-content|team-history|filmroom|wrong-background/.test(id)) {
    return 'user-facing';
  }
  if (/admin|qa|monitoring|ingest/.test(id)) return 'internal';
  if (/ux:|tap-target|overflow|zindex/.test(id)) return 'user-facing';
  return 'user-facing';
}

function inferEta(severity) {
  if (severity === 'critical' || severity === 'high') return 'short';
  if (severity === 'medium') return 'medium';
  return 'long';
}

function penaltyForCheck(check) {
  return SEVERITY_WEIGHTS[inferSeverity(check)] ?? 10;
}

function scoreFromChecks(checks, ids) {
  const relevant = ids.length
    ? checks.filter((c) => ids.some((id) => String(c.id || '').startsWith(id) || c.id === id))
    : checks;
  if (!relevant.length) return 100;
  const failed = relevant.filter((c) => !c.pass);
  const penalty = failed.reduce((sum, c) => sum + penaltyForCheck(c), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function moduleScoresFromRun(run) {
  const scores = {};
  QA_MODULES.forEach((mod) => {
    const checks = run.modules?.[mod]?.checks || [];
    scores[mod] = scoreFromChecks(checks, []);
  });
  scores.overall = overallScore(scores);
  return scores;
}

function overallScore(moduleScores) {
  let weighted = 0;
  let totalWeight = 0;
  Object.entries(MODULE_WEIGHTS).forEach(([mod, weight]) => {
    if (typeof moduleScores[mod] === 'number') {
      weighted += moduleScores[mod] * weight;
      totalWeight += weight;
    }
  });
  if (!totalWeight) return 0;
  return Math.round(weighted / totalWeight);
}

function pageScoresFromRun(run) {
  const allChecks = flattenChecks(run);
  const pages = {};

  Object.entries(PAGE_CHECKS).forEach(([path, cfg]) => {
    if (cfg.desktop || cfg.mobile) {
      pages[path] = {
        desktop: scoreFromChecks(allChecks, cfg.desktop || []),
        mobile: scoreFromChecks(allChecks, cfg.mobile || [])
      };
    } else {
      pages[path] = { score: scoreFromChecks(allChecks, cfg.score || []) };
    }
  });

  return pages;
}

function featureScoresFromRun(run, qaUptimePct) {
  const allChecks = flattenChecks(run);
  const features = {};
  Object.entries(FEATURE_CHECKS).forEach(([key, ids]) => {
    features[key] = scoreFromChecks(allChecks, ids);
  });
  if (typeof qaUptimePct === 'number') {
    features.qa_monitor = Math.round(Math.min(100, qaUptimePct));
  }
  return features;
}

function flattenChecks(run) {
  const out = [];
  Object.values(run.modules || {}).forEach((mod) => {
    (mod.checks || []).forEach((c) => out.push(c));
  });
  return out;
}

function healthColor(score) {
  if (score >= 85) return 'green';
  if (score >= 65) return 'yellow';
  return 'red';
}

function buildRecommendations({ moduleScores, featureScores, pageScores }) {
  const remove = [];
  const keep = [];
  const upgrade = [];

  Object.entries(featureScores || {}).forEach(([feature, score]) => {
    const label = feature.replace(/_/g, ' ');
    if (score >= 85) keep.push({ feature, score, reason: 'High score — core quality signal' });
    else if (score < 50) remove.push({ feature, score, reason: 'Low score — consider deprecating or hiding until fixed' });
    else if (score < 75) upgrade.push({ feature, score, reason: 'Important but not premium — prioritize UX polish' });
  });

  Object.entries(pageScores || {}).forEach(([path, cfg]) => {
    const vals = cfg.score != null ? [cfg.score] : [cfg.desktop, cfg.mobile].filter((v) => v != null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100;
    if (avg >= 85) keep.push({ page: path, score: avg, reason: 'Page health strong' });
    else if (avg < 55) upgrade.push({ page: path, score: avg, reason: 'Page needs structural or mobile fixes' });
  });

  if ((moduleScores?.['visual-integrity'] ?? 100) < 70) {
    upgrade.push({ area: 'visual-design', score: moduleScores['visual-integrity'], reason: 'Repeated theme/background contamination — upgrade Team and Film Room styling' });
  }

  if ((moduleScores?.integrity ?? 100) >= 90 && (moduleScores?.pages ?? 100) >= 85) {
    keep.push({ area: 'public-site', reason: 'Integrity and pages modules healthy' });
  }

  return { remove, keep, upgrade };
}

module.exports = {
  SEVERITY_WEIGHTS,
  MODULE_WEIGHTS,
  QA_MODULES,
  PAGE_CHECKS,
  FEATURE_CHECKS,
  inferSeverity,
  inferImpact,
  inferEta,
  moduleScoresFromRun,
  overallScore,
  pageScoresFromRun,
  featureScoresFromRun,
  flattenChecks,
  healthColor,
  buildRecommendations,
  scoreFromChecks
};
