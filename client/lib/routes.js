/**
 * Canonical route registry — single source for redirects and deploy-guardian.
 */
const vaultRoutes = require('./routes-vault.cjs');
const siteRoutes = require('./routes-site.cjs');

/** @typedef {{ from: string, to: string, status?: number, force?: boolean }} RedirectRule */

/** Legacy standalone + monolith HTML → vault (301). */
/** @type {RedirectRule[]} */
const LEGACY_RETIREMENT_REDIRECTS = [
  ...vaultRoutes.LEGACY_ROUTE_REDIRECTS.map((r) => ({
    ...r,
    status: 301,
  })),
];

/** @type {RedirectRule[]} */
const REACT_REWRITES = [
  // Flat product sitemap (canonical)
  ...siteRoutes.SITE_REACT_REWRITES,
  // Marketing landing + insider
  { from: '/welcome', to: '/', status: 301 },
  { from: '/welcome/', to: '/', status: 301 },
  { from: '/welcome/*', to: '/', status: 301 },
  { from: '/insider', to: '/insider/index.html', status: 200 },
  { from: '/insider/', to: '/insider/index.html', status: 200 },
  { from: '/insider/*', to: '/insider/index.html', status: 200 },
  { from: '/directory', to: '/directory/index.html', status: 200 },
  { from: '/directory/', to: '/directory/index.html', status: 200 },
  { from: '/directory/*', to: '/directory/index.html', status: 200 },
  { from: '/scouting/reports', to: '/scouting/reports/index.html', status: 200 },
  { from: '/scouting/reports/', to: '/scouting/reports/index.html', status: 200 },
  { from: '/scouting/queue', to: '/scouting/queue/index.html', status: 200 },
  { from: '/scouting/queue/', to: '/scouting/queue/index.html', status: 200 },
  { from: '/scouting/database', to: '/scouting/database/index.html', status: 200 },
  { from: '/scouting/database/', to: '/scouting/database/index.html', status: 200 },
  // Marketing + auth
  { from: '/join', to: '/join/index.html', status: 200 },
  { from: '/join/', to: '/join/index.html', status: 200 },
  { from: '/join/*', to: '/join/index.html', status: 200 },
  // Public standalone (non-vault) pages
  { from: '/player/*', to: '/player/index.html', status: 200 },
  { from: '/futurecast/predictions', to: '/futurecast', status: 301 },
  { from: '/futurecast/player/*', to: '/futurecast/player/index.html', status: 200 },
  { from: '/portal', to: '/recruiting/portal', status: 301 },
  { from: '/portal/', to: '/recruiting/portal', status: 301 },
  { from: '/portal/*', to: '/recruiting/portal', status: 301 },
  { from: '/recruiting-board', to: '/recruiting/board', status: 301 },
  { from: '/recruiting-board/*', to: '/recruiting/board', status: 301 },
  { from: '/gatornation-live', to: '/gator-nation-live', status: 301 },
  { from: '/gatornation-live/', to: '/gator-nation-live', status: 301 },
  { from: '/gatornation-live/*', to: '/gator-nation-live/:splat', status: 301 },
  { from: '/recruiting-hub', to: '/recruiting', status: 301 },
  { from: '/recruiting-hub/', to: '/recruiting', status: 301 },
  { from: '/recruiting-hub/*', to: '/recruiting/:splat', status: 301 },
  // Legacy vault static exports (301 to flat routes via LEGACY_RETIREMENT_REDIRECTS)
  ...vaultRoutes.VAULT_REACT_REWRITES,
  { from: '/scouting', to: '/recruiting/scouting', status: 301 },
  { from: '/scouting/*', to: '/recruiting/scouting', status: 301 },
  { from: '/players', to: '/team/player/index.html', status: 301 },
  { from: '/players/*', to: '/team/player/:splat', status: 301 },
  { from: '/alerts', to: '/alerts/index.html', status: 200 },
  { from: '/alerts/*', to: '/alerts/index.html', status: 200 },
  { from: '/staff', to: '/staff/index.html', status: 200 },
  { from: '/staff/dashboard', to: '/staff/dashboard/index.html', status: 200 },
  { from: '/staff/dashboard/*', to: '/staff/dashboard/index.html', status: 200 },
];

/** Legacy monolith query → canonical vault path (301). */
const LEGACY_VAULT_TAB_REDIRECTS = {
  start: '/',
  team: '/team',
  recruit: '/recruiting',
  futurecast: '/futurecast',
  portal: '/recruiting/portal',
  highlights: '/film-room/highlights',
  gameweek: '/game-week',
  live: '/gator-nation-live',
  analytics: '/futurecast/movement',
  scouting: '/recruiting/scouting',
  articles: '/articles',
  community: '/community',
  gamezone: '/game-zone',
  nil: '/nil',
  livescores: '/live-scores',
  players: '/team',
  alerts: '/vault/alerts',
  tickets: '/schedule',
  apparel: '/vault/apparel',
};

/** @type {RedirectRule[]} */
const ADMIN_AND_LEGACY_HTML = [
  { from: '/highlight/*', to: '/highlight.html', status: 200 },
  { from: '/article/*', to: '/articles/:splat', status: 301 },
  { from: '/admin', to: '/admin.html', status: 200 },
  { from: '/admin/hub', to: '/admin.html', status: 200 },
  { from: '/admin/hub/*', to: '/admin.html', status: 200 },
  { from: '/admin/login', to: '/admin-login.html', status: 200 },
  { from: '/admin/qa', to: '/admin-qa.html', status: 200 },
  { from: '/admin/embed/qa', to: '/admin-qa.html', status: 200 },
  { from: '/admin/product-health', to: '/admin-product-intel.html', status: 200 },
  { from: '/admin/embed/product-intel', to: '/admin-product-intel.html', status: 200 },
  { from: '/admin/ops', to: '/admin.html', status: 200 },
  { from: '/admin/feedback', to: '/admin.html', status: 200 },
  { from: '/admin/monitoring', to: '/admin.html', status: 200 },
  { from: '/admin/ops/identity-patterns', to: '/admin.html', status: 200 },
  { from: '/admin/ops/gm2', to: '/admin.html', status: 200 },
  { from: '/admin-ops/articles/edit/*', to: '/admin-ops-article-edit.html', status: 200 },
  { from: '/admin/ops/articles/edit/*', to: '/admin-ops-article-edit.html', status: 200 },
  { from: '/admin-ops/articles/*', to: '/admin-ops-article-view.html', status: 200 },
  { from: '/admin/ops/articles/*', to: '/admin-ops-article-view.html', status: 200 },
  { from: '/vault/ops', to: '/admin.html', status: 200 },
  { from: '/admin/self-runner', to: '/admin-self-runner.html', status: 200 },
  { from: '/admin/recruiting-board', to: '/admin.html', status: 200 },
  { from: '/admin/recruiting', to: '/admin.html', status: 200 },
];

const REQUIRED_VAULT_EXPORTS = [
  ...siteRoutes.REQUIRED_SITE_EXPORTS,
  ...vaultRoutes.REQUIRED_VAULT_EXPORTS,
];

/** Root serves elite marketing landing (client/app/(marketing)/page.tsx). /welcome redirects to /. */
/** @type {RedirectRule[]} */
const ROOT_LANDING_REDIRECT = [];

module.exports = {
  REACT_REWRITES,
  LEGACY_RETIREMENT_REDIRECTS,
  LEGACY_VAULT_TAB_REDIRECTS,
  ADMIN_AND_LEGACY_HTML,
  REQUIRED_VAULT_EXPORTS,
  ROOT_LANDING_REDIRECT,
};
