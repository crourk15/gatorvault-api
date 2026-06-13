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
    mobile: ['pages:home:mobile'],
    score: ['visual-integrity:landing-page']
  },
  '/vault': {
    desktop: ['pages:vault-dashboard:desktop'],
    mobile: ['pages:vault-dashboard:mobile']
  },
  '/vault/film-room': {
    score: [
      'pages:react-film-room',
      'pages:vault-film-room:desktop',
      'api:film-room-catalog',
      'visual-integrity:vault-film-room:markers'
    ]
  },
  '/vault/team': {
    score: [
      'pages:react-team',
      'pages:vault-team:desktop',
      'ux:modal-zindex',
      'ux:scroll-containers',
      'visual-integrity:vault-team:markers',
      'integrity:roster-data',
      'integrity:depth-chart-data',
      'api:roster-players'
    ]
  },
  '/vault/recruiting': {
    score: [
      'pages:react-recruiting-hub',
      'pages:vault-recruiting:desktop',
      'visual-integrity:vault-recruiting-hub:markers',
      'api:recruiting-board'
    ]
  },
  '/vault/live-feed': {
    score: [
      'pages:react-live-feed',
      'pages:vault-live-feed:desktop',
      'ux:live-feed-layout',
      'visual-integrity:live-feed-layout',
      'integrity:autoposter-dedup',
      'api:live-dashboard'
    ]
  },
  '/vault/futurecast': {
    score: ['pages:vault-futurecast:desktop', 'api:recruiting-board']
  },
  '/admin': {
    desktop: ['pages:admin-hub:desktop'],
    mobile: ['pages:admin-hub:mobile']
  }
};

const FEATURE_CHECKS = {
  react_vault_shell: [
    'integrity:production-vault-shell',
    'visual-integrity:vault-shell-theme',
    'ux:bottom-nav',
    'ux:tap-targets'
  ],
  team_roster_depth: [
    'pages:react-team',
    'integrity:roster-data',
    'integrity:depth-chart-data',
    'ux:scroll-containers'
  ],
  film_room_hub: [
    'pages:react-film-room',
    'api:film-room-catalog',
    'crawler:pressers-missing'
  ],
  recruiting_hub: [
    'pages:react-recruiting-hub',
    'api:recruiting-board',
    'api:war-room-breakdowns'
  ],
  live_feed: [
    'pages:react-live-feed',
    'ux:live-feed-layout',
    'integrity:autoposter-dedup',
    'api:live-feed',
    'api:live-dashboard',
    'mobile-behavior:react-vault-nav'
  ],
  mobile_navigation: ['ux:bottom-nav', 'ux:tap-targets', 'ux:mobile-safari'],
  admin_hub: ['pages:admin-hub:desktop', 'pages:admin-hub:mobile'],
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
  if (!relevant.length) return null;
  const failed = relevant.filter((c) => !c.pass);
  if (!failed.length) return 100;
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
    const value = moduleScores[mod];
    if (typeof value === 'number') {
      weighted += value * weight;
      totalWeight += weight;
    }
  });
  if (!totalWeight) return moduleScores.api ?? null;
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
