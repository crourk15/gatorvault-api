/**
 * Mobile deploy proof matrix — routes, recordings, section checklist.
 * Used by capture-mobile-deploy-proof.js before any push/deploy.
 */

/** User-facing routes for screenshot + menu proof (canonical vault paths). */
const PROOF_ROUTES = [
  { slug: 'vault-home', path: '/vault/', label: 'Home' },
  { slug: 'vault-recruiting', path: '/vault/recruiting/', label: 'Recruiting' },
  { slug: 'vault-team', path: '/vault/team/', label: 'Team' },
  { slug: 'vault-futurecast', path: '/vault/futurecast/', label: 'FutureCast' },
  { slug: 'vault-schedule', path: '/vault/schedule/', label: 'Schedule' },
  { slug: 'vault-film-room', path: '/vault/film-room/', label: 'Film Room', alias: '/vault/film/' },
  { slug: 'vault-articles', path: '/vault/articles/', label: 'Articles' },
  { slug: 'vault-nil', path: '/vault/nil/', label: 'NIL' },
  { slug: 'vault-game-zone', path: '/vault/game-zone/', label: 'Game Zone' },
  { slug: 'vault-podcasts', path: '/vault/live/podcasts/', label: 'Podcasts', fallback: '/vault/live/' },
  { slug: 'vault-tickets', path: '/vault/tickets/', label: 'Tickets' },
];

/** Cold-load screen recordings (mobile viewport, JS enabled). */
const RECORDING_ROUTES = [
  { slug: 'vault-home-load', path: '/vault/', label: 'Home load', durationMs: 15_000 },
  { slug: 'vault-recruiting-load', path: '/vault/recruiting/', label: 'Recruiting load', durationMs: 15_000 },
  { slug: 'vault-team-load', path: '/vault/team/', label: 'Team load', durationMs: 18_000 },
];

/**
 * Section checklist — pass/fail per feature area.
 * Each entry is evaluated on the given path after SETTLE_MS.
 */
const SECTION_CHECKLIST = [
  {
    id: 'roster',
    label: 'Roster',
    path: '/vault/team/',
    selector: '[data-section="roster"]',
    minText: 40,
    forbidden: ['Loading roster…', 'Waking up GatorVault'],
  },
  {
    id: 'depth-chart',
    label: 'Depth chart',
    path: '/vault/team/',
    selector: '[data-section="depth-chart"]',
    minText: 20,
  },
  {
    id: 'staff',
    label: 'Staff',
    path: '/vault/team/',
    selector: '[data-section="coaching-staff"]',
    minText: 20,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    path: '/vault/team/',
    selector: '[data-section="recruiting-pipeline"]',
    minText: 15,
  },
  {
    id: 'movement',
    label: 'Movement',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-elite-movement-feed"]',
    minText: 30,
    noSkeleton: true,
  },
  {
    id: 'beat-intel',
    label: 'Beat intel',
    path: '/vault/',
    selector: '[data-testid="home-beat-highlights"], [data-home-boot="beat-highlights"]',
    minText: 30,
  },
  {
    id: 'gnl',
    label: 'GNL',
    path: '/vault/live/',
    selector: '[data-testid="vault-live-feed"], .gv-live-feed',
    minText: 30,
  },
  {
    id: 'futurecast',
    label: 'FutureCast',
    path: '/vault/futurecast/',
    // Exclude vault-futurecast-page — layout SSR marker wins :first() with ~10 chars and blocks pass.
    selector: '[data-testid="fc-lab-page-mobile"], [data-testid="fc-lab-hero"]',
    minText: 30,
    waitForbiddenMs: 90_000,
    forbidden: ['Waking up GatorVault'],
  },
  {
    id: 'class-cards',
    label: 'Class cards',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-class-cards"]',
    minText: 40,
  },
  {
    id: 'commit-class',
    label: 'Commit class',
    path: '/vault/recruiting/',
    selector: '[data-testid^="rh-elite-commit-board"]',
    minText: 40,
    noSkeleton: true,
  },
  {
    id: 'below-nsd-movement',
    label: 'Below NSD — Movement feed',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-elite-movement-feed"]',
    minText: 30,
    noSkeleton: true,
    group: 'below-nsd',
  },
  {
    id: 'below-nsd-battle',
    label: 'Below NSD — Battle board',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-elite-battle-board"]',
    minText: 30,
    noSkeleton: true,
    group: 'below-nsd',
  },
  {
    id: 'below-nsd-footprint',
    label: 'Below NSD — Footprint',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-elite-footprint"]',
    minText: 20,
    noSkeleton: true,
    group: 'below-nsd',
  },
  {
    id: 'below-nsd-positions',
    label: 'Below NSD — Position snapshot',
    path: '/vault/recruiting/',
    selector: '[data-testid="rh-elite-position-snapshot"]',
    minText: 20,
    noSkeleton: true,
    group: 'below-nsd',
  },
];

/** Mobile layout + bottom-nav integrity (overflow, home route, menu reliability). */
const LAYOUT_NAV_CHECKS = [
  { id: 'nil-no-overflow', path: '/vault/nil/', label: 'NIL — no horizontal page overflow' },
  { id: 'game-zone-no-overflow', path: '/vault/game-zone/', label: 'Game Zone — no horizontal page overflow' },
  { id: 'nil-table-scroll', path: '/vault/nil/', label: 'NIL — rankings table scrolls in container' },
  { id: 'nil-home-vault', path: '/vault/nil/', label: 'Home from NIL stays in vault' },
  { id: 'nil-menu-stress', path: '/vault/nil/', label: 'NIL — menu open/close 3×' },
  { id: 'game-zone-menu-stress', path: '/vault/game-zone/', label: 'Game Zone — menu open/close 3×' },
];

const GLOBAL_FORBIDDEN = [
  'Waking up GatorVault',
  'Minified React error #423',
  'Application error: a client-side exception has occurred',
];

module.exports = {
  PROOF_ROUTES,
  RECORDING_ROUTES,
  SECTION_CHECKLIST,
  LAYOUT_NAV_CHECKS,
  GLOBAL_FORBIDDEN,
};
