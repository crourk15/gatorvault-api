/**
 * API Cache-Control policy — dynamic endpoints never cached; semi-static get short TTL.
 */
const DEPLOY_VERSION =
  process.env.RENDER_GIT_COMMIT?.slice(0, 12) ||
  process.env.GV_BUILD_ID ||
  process.env.GV_BUILD ||
  'dev';

/** Always fresh — no browser/CDN cache after deploy. */
const NO_STORE_PREFIXES = [
  '/api/futurecast/stock',
  '/api/futurecast/snapshots',
  '/api/futurecast/heatmap',
  '/api/futurecast/movement',
  '/api/futurecast/commits',
  '/api/futurecast/targets',
  '/api/futurecast/big-board',
  '/api/portal/',
  '/api/players/',
  '/api/recruiting/',
  '/api/roster/',
  '/api/articles/',
  '/api/film-room/',
  '/api/live/',
  '/api/product-intel/',
  '/api/qa/',
  '/api/health',
  '/api/ping',
];

/** Short TTL (seconds) — semi-static catalog/board data. */
const SHORT_TTL_ROUTES = [
  { prefix: '/api/futurecast/home', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/futurecast/class', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/futurecast/predictions', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/futurecast/staff-notes', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/futurecast/high-priority', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/recruits', maxAge: 300, sMaxAge: 600 },
  { prefix: '/api/film-room/catalog', maxAge: 60 },
  { prefix: '/api/recruiting/board', maxAge: 45 },
  { prefix: '/api/content/latest', maxAge: 120, sMaxAge: 120 },
  { prefix: '/api/live/ticker', maxAge: 30, sMaxAge: 30 },
  { prefix: '/api/staff/dashboard', maxAge: 300, sMaxAge: 300 },
  { prefix: '/api/recruiting/movement-intel', maxAge: 300, sMaxAge: 300 },
  { prefix: '/api/roster/players', maxAge: 45 },
  { prefix: '/api/articles/published', maxAge: 30 },
];

function cacheControlForPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  if (!path.startsWith('/api/')) return null;

  for (const route of SHORT_TTL_ROUTES) {
    if (path === route.prefix || path.startsWith(`${route.prefix}/`)) {
      const sMax = route.sMaxAge ?? route.maxAge;
      return `public, max-age=${route.maxAge}, s-maxage=${sMax}, stale-while-revalidate=60`;
    }
  }

  for (const prefix of NO_STORE_PREFIXES) {
    if (path === prefix.replace(/\/$/, '') || path.startsWith(prefix)) {
      return 'no-store, must-revalidate';
    }
  }

  return 'no-store, must-revalidate';
}

function apiCacheMiddleware() {
  return (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const cc = cacheControlForPath(req.path);
    if (cc) {
      res.setHeader('Cache-Control', cc);
      res.setHeader('Pragma', cc.includes('no-store') ? 'no-cache' : 'cache');
    }
    res.setHeader('X-GatorVault-API-Version', DEPLOY_VERSION);
    res.setHeader('Vary', 'Accept-Encoding');
    next();
  };
}

module.exports = {
  apiCacheMiddleware,
  cacheControlForPath,
  DEPLOY_VERSION,
};
