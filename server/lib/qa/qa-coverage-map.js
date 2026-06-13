/**
 * QA Crawler — full site coverage map (Section 2 blueprint).
 * Each section defines how to reach it, what to inspect, and expected structure.
 */
const SITE_SECTIONS = [
  {
    id: 'homepage',
    label: 'Marketing Landing',
    page: '/',
    areas: ['hero', 'futurecast-preview', 'pricing'],
    selectors: ['data-testid="landing-page"', 'gv-landing-hero', 'gv-landing-pricing']
  },
  {
    id: 'vault-dashboard',
    label: 'Vault Dashboard',
    page: '/vault',
    areas: ['quick-links', 'sidebar'],
    selectors: ['data-testid="vault-dashboard"', '.gv-vault-shell', '.gv-vault-shell__sidebar']
  },
  {
    id: 'team-overview',
    label: 'Team Overview (archive)',
    page: '/',
    legacy: true,
    areas: ['program-history', 'team-identity', 'traditions', 'culture', 'the-swamp'],
    desktop: { nav: { fn: 'showVTab', arg: 'team' } },
    mobile: { nav: { fn: 'gvMobileShowTab', arg: 'team' } },
    selectors: [
      '#vpane-team',
      '#vpane-mteam',
      '#gv-team-eras-track',
      '#gv-team-identity-slot',
      '#gv-team-achievements',
      '.gv-team-overview-layout'
    ]
  },
  {
    id: 'program-history',
    label: 'Program History',
    page: '/',
    parent: 'team-overview',
    selectors: [
      '#gv-team-eras-track',
      '#gv-team-detail-modal',
      '.gv-team-modal-body',
      '.gv-team-modal-panel'
    ],
    expectedOrder: ['era-70s80s', 'era-90s', 'era-2000s', 'era-2010s', 'era-2020s']
  },
  {
    id: 'film-room',
    label: 'Film Room (archive)',
    page: '/',
    legacy: true,
    areas: ['categories', 'clips', 'layout', 'headers'],
    desktop: { nav: { fn: 'showVTab', arg: 'highlights' } },
    mobile: { nav: { fn: 'gvMobileShowTab', arg: 'mhome' }, extra: 'film-room-hub' },
    selectors: [
      '#vpane-highlights',
      '.film-room-hub-shell',
      '.film-room-hub-landing',
      '#gv-verified-source-modal'
    ],
    expectedOrder: [
      'Offensive Scheme',
      'Defensive Scheme',
      'Film Breakdown',
      'UF Press Conferences',
      'Highlights'
    ]
  },
  {
    id: 'recruiting',
    label: 'Recruiting (archive)',
    page: '/',
    legacy: true,
    areas: ['recruiting-board', 'war-room', 'heat-meter', 'staff-confidence', 'player-cards'],
    desktop: { nav: { fn: 'showVTab', arg: 'recruit' } },
    mobile: { nav: { fn: 'gvMobileShowTab', arg: 'recruit' } },
    selectors: [
      '#vpane-recruit',
      '#vpane-scouting',
      '.recruit-board',
      '.war-room'
    ],
    apiEndpoints: ['/api/recruiting/board', '/api/war-room/breakdowns']
  },
  {
    id: 'roster',
    label: 'Roster',
    page: '/',
    parent: 'team-overview',
    selectors: ['#gv-team-roster-list', '#gv-team-roster-filters'],
    dataFiles: ['data/roster/players.json']
  },
  {
    id: 'depth-chart',
    label: 'Depth Chart',
    page: '/',
    parent: 'team-overview',
    selectors: ['#gv-team-dc-section', '#gv-team-dc-off', '#gv-team-dc-def'],
    expectedPositions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB']
  },
  {
    id: 'press-conferences',
    label: 'Press Conferences',
    page: '/',
    parent: 'film-room',
    selectors: ['#vpane-highlights'],
    markers: ['UF Press Conferences', 'gvOpenFilmRoomHub', 'press']
  },
  {
    id: 'highlights',
    label: 'Highlights',
    page: '/',
    parent: 'film-room',
    selectors: ['#highlight-modal-ov', '.highlight-card', 'openHighlightPlayer'],
    markers: ['Highlights', 'highlight-card']
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

const LOCAL_ASSETS = [
  'index.html',
  'legacy-index.html',
  'vault/index.html',
  'css/gv-team.css',
  'js/gv-team-mobile.js',
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
