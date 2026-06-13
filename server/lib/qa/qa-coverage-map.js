/**
 * QA Crawler — React vault coverage map (Phase 8 modernization).
 * Each section defines route, selectors, and expected structure for SSG/React pages.
 */
const SITE_SECTIONS = [
  {
    id: 'homepage',
    label: 'React Landing Page',
    page: '/',
    areas: ['hero', 'futurecast-preview', 'pricing'],
    selectors: ['[data-testid="landing-page"]', '.gv-landing-hero', '.gv-landing-pricing']
  },
  {
    id: 'vault-dashboard',
    label: 'Vault Dashboard',
    page: '/vault',
    areas: ['quick-links', 'sidebar'],
    selectors: ['[data-testid="vault-dashboard"]', '.gv-vault-shell', '.gv-vault-shell__sidebar']
  },
  {
    id: 'vault-team',
    label: 'React Team / Roster / Depth Chart',
    page: '/vault/team',
    areas: ['roster', 'depth-chart', 'portal-tags'],
    selectors: [
      '[data-testid="vault-team"]',
      '.gv-team-page',
      '.gv-hub-tabs',
      '.gv-team-roster',
      '.gv-dc-grid'
    ],
    dataFiles: ['data/roster/players.json'],
    apiEndpoints: ['/api/roster/players']
  },
  {
    id: 'vault-film-room',
    label: 'React Film Room',
    page: '/vault/film-room',
    areas: ['categories', 'lessons', 'verified-sources'],
    selectors: [
      '[data-testid="vault-film-room"]',
      '.gv-film-room',
      '.gv-film-hub-grid',
      '.gv-film-hub-card',
      '.gv-film-lessons'
    ],
    expectedOrder: [
      'Offensive Scheme',
      'Defensive Scheme',
      'Film Breakdown',
      'UF Press Conferences',
      'Highlights'
    ],
    apiEndpoints: ['/api/film-room/catalog']
  },
  {
    id: 'vault-recruiting',
    label: 'React Recruiting Hub',
    page: '/vault/recruiting',
    areas: ['commits', 'targets', 'heat-check', 'scouting', 'portal', 'intel'],
    selectors: [
      '[data-testid="vault-recruiting-hub"]',
      '.gv-recruiting-hub',
      '.gv-hub-tabs',
      '.gv-rh-grid',
      '.gv-heat-columns'
    ],
    apiEndpoints: ['/api/recruiting/board', '/api/war-room/breakdowns']
  },
  {
    id: 'vault-futurecast',
    label: 'React FutureCast',
    page: '/vault/futurecast',
    areas: ['big-board', 'commits', 'movement-intel'],
    selectors: ['[data-testid="vault-futurecast-page"]', '.fc-futurecast-page'],
    apiEndpoints: ['/api/recruiting/board']
  },
  {
    id: 'vault-live-feed',
    label: 'React Live Feed',
    page: '/vault/live-feed',
    areas: ['headlines', 'beat-writers', 'podcasts', 'ticker'],
    selectors: [
      '[data-testid="vault-live-feed"]',
      '.gv-live-feed',
      '.gv-live-ticker',
      '.gv-live-feed__tabs',
      '.gv-live-feed__list'
    ],
    apiEndpoints: ['/api/live/dashboard']
  },
  {
    id: 'vault-tickets',
    label: 'Schedule & Tickets',
    page: '/vault/schedule',
    areas: ['schedule', 'ticket-links'],
    selectors: ['[data-testid="vault-schedule"]', '.gv-schedule-list', '.gv-ticket-card']
  },
  {
    id: 'admin-hub',
    label: 'Admin Hub',
    page: '/admin',
    areas: ['pin', 'session', 'routing', 'errors'],
    selectors: ['#pin', 'admin-hub-core', 'GatorVault'],
    isAdmin: true
  },
  {
    id: 'api-health',
    label: 'API Health',
    page: null,
    apiOnly: true,
    endpoints: [
      { id: 'ping', path: '/api/ping', latencyWarnMs: 500, latencyFailMs: 2000 },
      { id: 'live-dashboard', path: '/api/live/dashboard', cacheMaxAgeSec: 45 },
      { id: 'recruiting-board', path: '/api/recruiting/board', cacheMaxAgeSec: 300 }
    ]
  }
];

/** Blueprint rule → check id prefix mapping */
const RULE_CATALOG = {
  A1: { id: 'crawler:overflow', classification: 'layout-overflow', name: 'Overflow Detection' },
  A2: { id: 'crawler:layering', classification: 'panel-clipping', name: 'Layering / Z-Index' },
  A3: { id: 'crawler:background', classification: 'wrong-background', name: 'Wrong Background' },
  A4: { id: 'crawler:viewport-divergence', classification: 'mobile-desktop-divergence', name: 'Mobile/Desktop Divergence' },
  B1: { id: 'crawler:missing-content', classification: 'missing-content', name: 'Missing Content' },
  B2: { id: 'crawler:wrong-ordering', classification: 'wrong-ordering', name: 'Wrong Ordering' },
  B3: { id: 'crawler:stale-content', classification: 'autoposter-stale', name: 'Stale Content' },
  C1: { id: 'crawler:autoposter-dup', classification: 'autoposter-duplication', name: 'Duplicate Posts' },
  C2: { id: 'crawler:autoposter-similarity', classification: 'autoposter-duplication', name: 'Similarity Detection' },
  C3: { id: 'crawler:uf-only', classification: 'missing-content', name: 'UF-Only Filter' },
  C4: { id: 'crawler:autoposter-stale', classification: 'autoposter-stale', name: 'Stale Autoposter' },
  D1: { id: 'crawler:recruiting-mismatch', classification: 'recruiting-board-mismatch', name: 'Recruiting Board Mismatch' },
  D2: { id: 'crawler:war-room', classification: 'recruiting-board-mismatch', name: 'War Room Mismatch' },
  E1: { id: 'crawler:roster-mismatch', classification: 'roster-mismatch', name: 'Roster Mismatch' },
  E2: { id: 'crawler:depth-chart', classification: 'depth-chart-mismatch', name: 'Depth Chart Mismatch' },
  F1: { id: 'crawler:api-latency', classification: 'api-latency', name: 'API Latency' },
  F2: { id: 'crawler:cache-stale', classification: 'cache-stale', name: 'Cache Stale' },
  F3: { id: 'crawler:404', classification: '404-detected', name: '404 Detection' }
};

/** Local React static exports + admin — no monolith gv-team-mobile.js */
const LOCAL_ASSETS = [
  'index.html',
  'vault/index.html',
  'vault/team/index.html',
  'vault/recruiting/index.html',
  'vault/futurecast/index.html',
  'vault/live-feed/index.html',
  'vault/film-room/index.html',
  'vault/schedule/index.html',
  'js/admin-hub-core.js',
  'admin-product-intel.html',
  'admin-qa.html'
];

function sectionById(id) {
  return SITE_SECTIONS.find((s) => s.id === id) || null;
}

function allSelectors() {
  const set = new Set();
  SITE_SECTIONS.forEach((s) => (s.selectors || []).forEach((sel) => set.add(sel)));
  return [...set];
}

module.exports = {
  SITE_SECTIONS,
  RULE_CATALOG,
  LOCAL_ASSETS,
  sectionById,
  allSelectors
};
