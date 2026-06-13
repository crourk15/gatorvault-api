/**
 * Canonical route registry — single source for redirects and deploy-guardian.
 */
const vaultRoutes = require('./routes-vault.cjs');

/** @typedef {{ from: string, to: string, status?: number, force?: boolean }} RedirectRule */

/** Legacy standalone + monolith HTML → vault (301). */
/** @type {RedirectRule[]} */
const LEGACY_RETIREMENT_REDIRECTS = vaultRoutes.LEGACY_ROUTE_REDIRECTS.map((r) => ({
  ...r,
  status: 301,
}));

/** @type {RedirectRule[]} */
const REACT_REWRITES = [
  // Marketing + auth
  { from: '/join', to: '/join/index.html', status: 200 },
  { from: '/join/', to: '/join/index.html', status: 200 },
  { from: '/join/*', to: '/join/index.html', status: 200 },
  // Public standalone (non-vault) pages
  { from: '/player/*', to: '/player/index.html', status: 200 },
  { from: '/portal', to: '/vault/recruiting/portal', status: 301 },
  { from: '/portal/', to: '/vault/recruiting/portal', status: 301 },
  { from: '/portal/*', to: '/vault/recruiting/portal', status: 301 },
  { from: '/recruiting-board', to: '/vault/recruiting', status: 301 },
  { from: '/recruiting-board/*', to: '/vault/recruiting', status: 301 },
  { from: '/recruiting', to: '/vault/recruiting', status: 301 },
  { from: '/recruits', to: '/vault/recruiting', status: 301 },
  { from: '/scouting', to: '/vault/recruiting/scouting', status: 301 },
  { from: '/scouting/*', to: '/vault/recruiting/scouting', status: 301 },
  { from: '/players', to: '/vault/players', status: 301 },
  { from: '/players/*', to: '/vault/players/index.html', status: 200 },
  { from: '/alerts', to: '/alerts/index.html', status: 200 },
  { from: '/alerts/*', to: '/alerts/index.html', status: 200 },
  { from: '/staff', to: '/staff/index.html', status: 200 },
  { from: '/staff/dashboard', to: '/staff/dashboard/index.html', status: 200 },
  { from: '/staff/dashboard/*', to: '/staff/dashboard/index.html', status: 200 },
  // Vault — React-native route map (Phase 8 final)
  ...vaultRoutes.VAULT_REACT_REWRITES,
  // Secondary vault (drawer only — still exported if present)
  { from: '/vault/game-week', to: '/vault/game-week/index.html', status: 200 },
  { from: '/vault/game-week/*', to: '/vault/game-week/index.html', status: 200 },
  { from: '/vault/live-scores', to: '/vault/live-scores/index.html', status: 200 },
  { from: '/vault/live-scores/*', to: '/vault/live-scores/index.html', status: 200 },
  { from: '/vault/articles', to: '/vault/articles/index.html', status: 200 },
  { from: '/vault/articles/*', to: '/vault/articles/index.html', status: 200 },
  { from: '/vault/community', to: '/vault/community/index.html', status: 200 },
  { from: '/vault/community/*', to: '/vault/community/index.html', status: 200 },
  { from: '/vault/game-zone', to: '/vault/game-zone/index.html', status: 200 },
  { from: '/vault/game-zone/*', to: '/vault/game-zone/index.html', status: 200 },
  { from: '/vault/nil', to: '/vault/nil/index.html', status: 200 },
  { from: '/vault/nil/*', to: '/vault/nil/index.html', status: 200 },
  { from: '/vault/staff', to: '/vault/staff/index.html', status: 200 },
  { from: '/vault/alerts', to: '/vault/alerts/index.html', status: 200 },
  { from: '/vault/alerts/*', to: '/vault/alerts/index.html', status: 200 },
  { from: '/vault/apparel', to: '/vault/apparel/index.html', status: 200 },
  { from: '/vault/apparel/*', to: '/vault/apparel/index.html', status: 200 },
];

/** Legacy monolith query → canonical vault path (301). */
const LEGACY_VAULT_TAB_REDIRECTS = {
  start: '/vault',
  team: '/vault/team',
  recruit: '/vault/recruiting',
  futurecast: '/vault/futurecast',
  portal: '/vault/recruiting/portal',
  highlights: '/vault/film-room/highlights',
  gameweek: '/vault/game-week',
  live: '/vault/live-feed',
  analytics: '/vault/futurecast/movement',
  scouting: '/vault/recruiting/scouting',
  articles: '/vault/articles',
  community: '/vault/community',
  gamezone: '/vault/game-zone',
  nil: '/vault/nil',
  livescores: '/vault/live-scores',
  players: '/vault/players',
  alerts: '/vault/alerts',
  tickets: '/vault/schedule',
  apparel: '/vault/apparel',
};

/** @type {RedirectRule[]} */
const ADMIN_AND_LEGACY_HTML = [
  { from: '/highlight/*', to: '/highlight.html', status: 200 },
  { from: '/article/*', to: '/article.html', status: 200 },
  { from: '/admin', to: '/admin.html', status: 200 },
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
  { from: '/admin/recruiting-board', to: '/admin.html', status: 200 },
  { from: '/admin/recruiting', to: '/admin.html', status: 200 },
];

const REQUIRED_VAULT_EXPORTS = vaultRoutes.REQUIRED_VAULT_EXPORTS;

module.exports = {
  REACT_REWRITES,
  LEGACY_RETIREMENT_REDIRECTS,
  LEGACY_VAULT_TAB_REDIRECTS,
  ADMIN_AND_LEGACY_HTML,
  REQUIRED_VAULT_EXPORTS,
};
