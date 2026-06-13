/**
 * Canonical vault route map (CJS) — mirrors client/lib/vault-route-map.ts
 * Used by routes.js, server crawler, and QA validation.
 */
const VAULT_PILLAR_ROUTES = {
  dashboard: '/vault',
  recruiting: '/vault/recruiting',
  futurecast: '/vault/futurecast',
  team: '/vault/team',
  depthChart: '/vault/depth-chart',
  liveFeed: '/vault/live-feed',
  filmRoom: '/vault/film-room',
  schedule: '/vault/schedule',
};

/** QA markers per pillar export */
const PILLAR_QA = {
  '/vault': { testid: 'vault-dashboard', markers: ['vault-dashboard', 'gv-vault-shell'] },
  '/vault/recruiting': { testid: 'vault-recruiting-hub', markers: ['vault-recruiting-hub', 'Recruiting Hub'] },
  '/vault/futurecast': { testid: 'vault-futurecast-page', markers: ['vault-futurecast-page', 'FutureCast'] },
  '/vault/team': { testid: 'vault-team', markers: ['vault-team', 'gv-team-page'] },
  '/vault/live-feed': { testid: 'vault-live-feed', markers: ['vault-live-feed', 'gv-live-feed'] },
  '/vault/film-room': { testid: 'vault-film-room', markers: ['vault-film-room', 'gv-film-room'] },
  '/vault/schedule': { testid: 'vault-schedule', markers: ['vault-schedule', 'Schedule'] },
  '/': { testid: 'landing-page', markers: ['landing-page'] },
};

const RECRUITING_SUB_ROUTES = [
  '/vault/recruiting/2026/commits',
  '/vault/recruiting/2027/commits',
  '/vault/recruiting/2026/targets',
  '/vault/recruiting/2027/targets',
  '/vault/recruiting/heat-check',
  '/vault/recruiting/scouting',
  '/vault/recruiting/portal',
  '/vault/recruiting/movement',
];

const PLAYER_PROFILE_ROUTES = {
  roster: '/vault/players/[slug]',
  futurecast: '/vault/futurecast/player/[slug]',
  recruiting: '/vault/recruiting/player/[slug]',
};

const RETIRED_CHECKS = [
  'pages:team-hooks',
  'pages:film-room-hooks',
  'integrity:missing-content',
  'integrity:filmroom-structure',
  'integrity:team-history-structure',
  'integrity:wrong-background',
  'mobile-behavior:team-tab-theme',
];

const RETIRED_PATTERNS = [
  'vpane-start',
  'vpane-mteam',
  'gvOpenTeamDetail',
  'gvOpenVerifiedSource',
  'openHighlightPlayer',
  'highlight-card',
  'film-room-hub-landing',
  'gv-team-mobile.js',
  'gv-hscroll-track',
];

const LEGACY_ROUTE_REDIRECTS = [
  { from: '/futurecast', to: '/vault/futurecast' },
  { from: '/futurecast/', to: '/vault/futurecast' },
  { from: '/futurecast/*', to: '/vault/futurecast' },
  { from: '/team.html', to: '/vault/team' },
  { from: '/recruiting.html', to: '/vault/recruiting' },
  { from: '/film-room.html', to: '/vault/film-room' },
  { from: '/latest-updates.html', to: '/vault/live-feed' },
  { from: '/portal.html', to: '/vault/recruiting/portal' },
  { from: '/vault/tickets', to: '/vault/schedule' },
  { from: '/vault/tickets/', to: '/vault/schedule' },
  { from: '/vault/tickets/*', to: '/vault/schedule' },
  { from: '/vault/portal', to: '/vault/recruiting/portal' },
  { from: '/vault/portal/', to: '/vault/recruiting/portal' },
  { from: '/vault/portal/*', to: '/vault/recruiting/portal' },
  { from: '/vault/scouting', to: '/vault/recruiting/scouting' },
  { from: '/vault/scouting/', to: '/vault/recruiting/scouting' },
  { from: '/vault/scouting/*', to: '/vault/recruiting/scouting' },
  { from: '/vault/recruiting-board', to: '/vault/recruiting' },
  { from: '/vault/recruiting-board/*', to: '/vault/recruiting' },
  { from: '/vault/portal/player/*', to: '/vault/recruiting/player/:splat' },
  { from: '/vault/depth-chart', to: '/vault/team' },
  { from: '/vault/depth-chart/', to: '/vault/team' },
  { from: '/vault/depth-chart/*', to: '/vault/team' },
];

function subRouteRewrites(prefix, exportPath) {
  return [
    { from: prefix, to: exportPath, status: 200 },
    { from: `${prefix}/`, to: exportPath, status: 200 },
    { from: `${prefix}/*`, to: exportPath, status: 200 },
  ];
}

const VAULT_REACT_REWRITES = [
  ...subRouteRewrites('/vault/recruiting', '/vault/recruiting/index.html'),
  ...subRouteRewrites('/vault/futurecast', '/vault/futurecast/index.html'),
  { from: '/vault/futurecast/player/*', to: '/vault/futurecast/player/index.html', status: 200 },
  { from: '/vault/recruiting/player/*', to: '/vault/recruiting/player/index.html', status: 200 },
  ...subRouteRewrites('/vault/team', '/vault/team/index.html'),
  { from: '/vault/players/*', to: '/vault/players/index.html', status: 200 },
  ...subRouteRewrites('/vault/live-feed', '/vault/live-feed/index.html'),
  ...subRouteRewrites('/vault/film-room', '/vault/film-room/index.html'),
  ...subRouteRewrites('/vault/schedule', '/vault/schedule/index.html'),
  { from: '/vault', to: '/vault/index.html', status: 200 },
  { from: '/vault/', to: '/vault/index.html', status: 200 },
];

const REQUIRED_VAULT_EXPORTS = [
  'join/index.html',
  'index.html',
  'vault/index.html',
  'vault/recruiting/index.html',
  'vault/recruiting/player/index.html',
  'vault/futurecast/index.html',
  'vault/futurecast/player/index.html',
  'vault/team/index.html',
  'vault/players/index.html',
  'vault/live-feed/index.html',
  'vault/film-room/index.html',
  'vault/schedule/index.html',
];

function routeToExport(routePath) {
  if (routePath === '/') return 'index.html';
  return `${routePath.replace(/^\//, '')}/index.html`;
}

function allPillarRoutes() {
  return Object.values(VAULT_PILLAR_ROUTES);
}

module.exports = {
  VAULT_PILLAR_ROUTES,
  PILLAR_QA,
  RECRUITING_SUB_ROUTES,
  PLAYER_PROFILE_ROUTES,
  RETIRED_CHECKS,
  RETIRED_PATTERNS,
  LEGACY_ROUTE_REDIRECTS,
  VAULT_REACT_REWRITES,
  REQUIRED_VAULT_EXPORTS,
  subRouteRewrites,
  routeToExport,
  allPillarRoutes,
};
