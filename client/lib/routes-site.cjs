/**
 * Flat site route rewrites (CJS) — used by routes.js + generate-redirects.
 */

function subRouteRewrites(prefix, exportPath) {
  return [
    { from: prefix, to: exportPath, status: 200 },
    { from: `${prefix}/`, to: exportPath, status: 200 },
    { from: `${prefix}/*`, to: exportPath, status: 200 },
  ];
}

/** Dynamic routes — wildcard → single index.html (slug parsed client-side). */
const SITE_DYNAMIC_REWRITES = [
  { from: '/recruiting/player/*', to: '/recruiting/player/index.html', status: 200 },
  { from: '/futurecast/player/*', to: '/futurecast/player/index.html', status: 200 },
  { from: '/team/player/*', to: '/team/player/index.html', status: 200 },
  { from: '/schedule/*', to: '/schedule/season/index.html', status: 200 },
  { from: '/game-week/*', to: '/game-week/game/index.html', status: 200 },
  { from: '/articles/*', to: '/articles/detail/index.html', status: 200 },
  { from: '/community/thread/*', to: '/community/thread/detail/index.html', status: 200 },
  { from: '/game-zone/*', to: '/game-zone/game/index.html', status: 200 },
];

const SITE_STATIC_REWRITES = [
  ...subRouteRewrites('/', '/index.html'),
  ...subRouteRewrites('/recruiting', '/recruiting/index.html'),
  ...subRouteRewrites('/futurecast', '/futurecast/index.html'),
  ...subRouteRewrites('/futurecast/trending', '/futurecast/trending/index.html'),
  ...subRouteRewrites('/futurecast/movement', '/futurecast/movement/index.html'),
  ...subRouteRewrites('/futurecast/staff', '/futurecast/staff/index.html'),
  ...subRouteRewrites('/team', '/team/index.html'),
  ...subRouteRewrites('/gator-nation-live', '/gator-nation-live/index.html'),
  ...subRouteRewrites('/schedule', '/schedule/index.html'),
  ...subRouteRewrites('/film-room', '/film-room/index.html'),
  ...subRouteRewrites('/game-week', '/game-week/index.html'),
  ...subRouteRewrites('/live-scores', '/live-scores/index.html'),
  ...subRouteRewrites('/articles', '/articles/index.html'),
  ...subRouteRewrites('/community', '/community/index.html'),
  ...subRouteRewrites('/game-zone', '/game-zone/index.html'),
  ...subRouteRewrites('/nil', '/nil/index.html'),
];

const SITE_REACT_REWRITES = [...SITE_DYNAMIC_REWRITES, ...SITE_STATIC_REWRITES];

const VAULT_TO_SITE_REDIRECTS = [
  { from: '/vault', to: '/', status: 301 },
  { from: '/vault/', to: '/', status: 301 },
  { from: '/vault/recruiting', to: '/recruiting', status: 301 },
  { from: '/vault/recruiting/*', to: '/recruiting/:splat', status: 301 },
  { from: '/vault/futurecast', to: '/futurecast', status: 301 },
  { from: '/vault/futurecast/*', to: '/futurecast/:splat', status: 301 },
  { from: '/vault/team', to: '/team', status: 301 },
  { from: '/vault/team/*', to: '/team/:splat', status: 301 },
  { from: '/vault/live', to: '/gator-nation-live', status: 301 },
  { from: '/vault/live/*', to: '/gator-nation-live/:splat', status: 301 },
  { from: '/vault/live-feed', to: '/gator-nation-live', status: 301 },
  { from: '/vault/live-feed/*', to: '/gator-nation-live/:splat', status: 301 },
  { from: '/vault/schedule', to: '/schedule', status: 301 },
  { from: '/vault/schedule/*', to: '/schedule/:splat', status: 301 },
  { from: '/vault/film-room', to: '/film-room', status: 301 },
  { from: '/vault/film-room/*', to: '/film-room/:splat', status: 301 },
  { from: '/vault/game-week', to: '/game-week', status: 301 },
  { from: '/vault/game-week/*', to: '/game-week/:splat', status: 301 },
  { from: '/vault/live-scores', to: '/live-scores', status: 301 },
  { from: '/vault/live-scores/*', to: '/live-scores/:splat', status: 301 },
  { from: '/vault/articles', to: '/articles', status: 301 },
  { from: '/vault/articles/*', to: '/articles/:splat', status: 301 },
  { from: '/vault/community', to: '/community', status: 301 },
  { from: '/vault/community/*', to: '/community/:splat', status: 301 },
  { from: '/vault/game-zone', to: '/game-zone', status: 301 },
  { from: '/vault/game-zone/*', to: '/game-zone/:splat', status: 301 },
  { from: '/vault/nil', to: '/nil', status: 301 },
  { from: '/vault/nil/*', to: '/nil/:splat', status: 301 },
  { from: '/vault/players/*', to: '/team/player/:splat', status: 301 },
  { from: '/gatornation-live', to: '/gator-nation-live', status: 301 },
  { from: '/gatornation-live/*', to: '/gator-nation-live/:splat', status: 301 },
  { from: '/recruiting-hub', to: '/recruiting', status: 301 },
  { from: '/recruiting-hub/*', to: '/recruiting/:splat', status: 301 },
  { from: '/recruiting', to: '/recruiting/index.html', status: 200 },
];

const REQUIRED_SITE_EXPORTS = [
  'index.html',
  'recruiting/index.html',
  'recruiting/player/index.html',
  'futurecast/index.html',
  'futurecast/player/index.html',
  'team/index.html',
  'team/player/index.html',
  'gator-nation-live/index.html',
  'schedule/index.html',
  'schedule/season/index.html',
  'film-room/index.html',
  'game-week/index.html',
  'game-week/game/index.html',
  'live-scores/index.html',
  'articles/index.html',
  'articles/detail/index.html',
  'community/index.html',
  'community/thread/detail/index.html',
  'game-zone/index.html',
  'game-zone/game/index.html',
  'nil/index.html',
];

module.exports = {
  SITE_REACT_REWRITES,
  VAULT_TO_SITE_REDIRECTS,
  REQUIRED_SITE_EXPORTS,
  subRouteRewrites,
};
