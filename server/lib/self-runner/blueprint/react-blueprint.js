/**
 * Self-Runner 3.0 — React vault blueprint (routes from vault-route-map).
 */
const vaultMap = require('../../../../client/lib/routes-vault.cjs');

const REACT_ARCHITECTURE_VERSION = '4.1.0';

/** Files the self-runner must NEVER modify (monolith archive). */
const FORBIDDEN_PATCH_FILES = [
  'legacy-index.html',
  'js/gv-team-mobile.js',
  'css/gv-team.css'
];

/** Monolith edit types that must never be applied. */
const FORBIDDEN_EDIT_TYPES = [
  'ensure-team-shell',
  'add-class-to-region',
  'remove-class-from-region',
  'class-swap-in-region',
  'insert-after-region-open',
  'insert-after-anchor',
  'html-hook',
  'html-hook-v2',
  'verify-hooks'
];

/** Vault pillar routes → React component + testid. */
const VAULT_ROUTES = {
  '/vault': {
    component: 'client/components/vault/VaultDashboardPage.tsx',
    testid: 'vault-dashboard',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/recruiting': {
    component: 'client/components/vault/VaultRecruitingHubPage.tsx',
    testid: 'vault-recruiting-hub',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/team': {
    component: 'client/components/vault/VaultTeamPage.tsx',
    testid: 'vault-team',
    data: 'client/lib/depth-chart-data.ts',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/film-room': {
    component: 'client/components/vault/VaultFilmRoomPage.tsx',
    testid: 'vault-film-room',
    data: 'client/lib/film-room-api.ts',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/live-feed': {
    component: 'client/components/vault/VaultLiveFeedPage.tsx',
    testid: 'vault-live-feed',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/futurecast': {
    component: 'client/app/vault/futurecast/page.tsx',
    testid: 'vault-futurecast-page',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/tickets': {
    component: 'client/components/vault/VaultTicketsPage.tsx',
    testid: 'vault-schedule',
    css: 'client/lib/vault-shell.css'
  },
  '/vault/schedule': {
    component: 'client/components/vault/VaultTicketsPage.tsx',
    testid: 'vault-schedule',
    css: 'client/lib/vault-shell.css'
  },
  '/': {
    component: 'client/app/page.tsx',
    testid: 'landing-page',
    css: 'client/lib/vault-shell.css'
  }
};

const SHELL_FILES = {
  layout: 'client/components/vault/VaultShell.tsx',
  routes: 'client/lib/vault-routes.ts',
  netlifyRoutes: 'client/lib/routes.js',
  css: 'client/lib/vault-shell.css'
};

/** Eligible React fix categories. */
const REACT_FIX_TYPES = {
  'react-route': { risk: 'medium', files: ['client/lib/routes.js', 'netlify.toml'] },
  'react-component': { risk: 'medium', files: ['client/components/vault/'] },
  'react-css': { risk: 'low', files: ['client/lib/vault-shell.css'] },
  'react-slug': { risk: 'medium', files: ['client/lib/slug.ts', 'client/lib/player-routes.ts'] },
  'react-api-path': { risk: 'low', files: ['client/lib/*-api.ts'] },
  'react-rebuild': { risk: 'low', files: ['server/vault/'] },
  'feed-dedup-v2': { risk: 'low', files: ['data/live/feed-items.json'] },
  'film-source-url': { risk: 'low', files: ['data/film-room-knowledge/'] },
  'schema-field-v2': { risk: 'low', files: ['data/'] }
};

/** Map QA check IDs → React route for explanations. */
const CHECK_TO_ROUTE = {
  'pages:home': '/',
  'pages:home:desktop': '/',
  'pages:home:mobile': '/',
  'pages:vault-dashboard': '/vault',
  'pages:vault-recruiting': '/vault/recruiting',
  'pages:vault-team': '/vault/team',
  'pages:vault-film-room': '/vault/film-room',
  'pages:vault-live-feed': '/vault/live-feed',
  'pages:vault-futurecast': '/vault/futurecast',
  'pages:vault-schedule': '/vault/schedule',
  'pages:vault-tickets': '/vault/schedule',
  'pages:react-team': '/vault/team',
  'pages:react-film-room': '/vault/film-room',
  'pages:react-recruiting-hub': '/vault/recruiting',
  'pages:react-live-feed': '/vault/live-feed',
  'integrity:react-routes': '/vault',
  'integrity:react-exports': '/vault',
  'integrity:react-markers': '/vault',
  'ux:bottom-nav': '/vault',
  'ux:live-feed-layout': '/vault/live-feed',
  'mobile-behavior:react-vault-nav': '/vault'
};

function routeForCheck(checkId) {
  const id = String(checkId || '');
  for (const [prefix, route] of Object.entries(CHECK_TO_ROUTE)) {
    if (id.startsWith(prefix) || id.includes(prefix.replace('pages:', ''))) return route;
  }
  if (/team|roster|depth/.test(id)) return '/vault/team';
  if (/film|press|highlight/.test(id)) return '/vault/film-room';
  if (/recruit|war-room|portal/.test(id)) return '/vault/recruiting';
  if (/live-feed|feed|ticker|beat/.test(id)) return '/vault/live-feed';
  if (/futurecast|movement|staff/.test(id)) return '/vault/futurecast';
  return '/vault';
}

function componentForRoute(route) {
  return VAULT_ROUTES[route] || VAULT_ROUTES['/vault'];
}

function isForbiddenFile(rel) {
  const norm = String(rel || '').replace(/^\//, '').replace(/\\/g, '/');
  if (FORBIDDEN_PATCH_FILES.some((f) => norm === f || norm.endsWith(`/${f}`))) return true;
  if (norm === 'index.html' && !norm.includes('vault/')) {
    return false; /* landing index is React export — allow data-only, block vpane edits via edit type */
  }
  return false;
}

function isForbiddenEdit(edit) {
  if (!edit) return false;
  if (FORBIDDEN_EDIT_TYPES.includes(edit.type)) return true;
  if (edit.regionId && /^vpane-/.test(edit.regionId)) return true;
  if (edit.hookId && /gvOpen|openHighlight|film-room-hub|vpane/.test(edit.hookId)) return true;
  if (isForbiddenFile(edit.file)) return true;
  return false;
}

function reactExplanation(checkId, issue) {
  try {
    const explainers = require('../explainers/react-explainers');
    return explainers.explain(checkId, issue);
  } catch {
    const route = routeForCheck(checkId);
    const meta = componentForRoute(route);
    const detail = issue?.error || issue?.message || issue?.title || checkId;
    return `React vault route ${route} — fix in ${meta.component}. ${detail}`;
  }
}

module.exports = {
  REACT_ARCHITECTURE_VERSION,
  FORBIDDEN_PATCH_FILES,
  FORBIDDEN_EDIT_TYPES,
  VAULT_ROUTES,
  SHELL_FILES,
  REACT_FIX_TYPES,
  CHECK_TO_ROUTE,
  routeForCheck,
  componentForRoute,
  isForbiddenFile,
  isForbiddenEdit,
  reactExplanation
};
