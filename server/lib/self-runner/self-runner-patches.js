/**
 * Self-Runner — patch eligibility & React-native routing (no monolith HTML patches).
 */
const path = require('path');
const reactBp = require('./blueprint/react-blueprint');

const SERVER_ROOT = path.join(__dirname, '..', '..');

const FILM_SOURCE_FALLBACKS = {
  default: 'https://247sports.com/college/florida/',
  nfl: 'https://www.nfl.com/news/2026-nfl-scouting-combine-dates-times-how-to-watch-and-more',
  florida: 'https://floridagators.com/news/2025/12/19/football-gators-meet-brad-white-floridas-new-defensive-coordinator-southeastern-conference-florida-gators',
  on3: 'https://www.on3.com/college/florida-gators/',
  espn: 'https://www.espn.com/college-football/'
};

/** React-native eligible fix types */
const ELIGIBILITY = [
  { test: (i) => /^pages:react-/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^pages:vault-/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^pages:home:/.test(i.checkId || ''), patchType: 'react-rebuild', eligible: true },
  { test: (i) => /integrity:react-/.test(i.checkId || ''), patchType: 'react-rebuild', eligible: true },
  { test: (i) => /^ux:/.test(i.checkId || ''), patchType: 'react-css', eligible: true },
  { test: (i) => /^visual-integrity:/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /mobile-behavior:react-vault-nav/.test(i.checkId || ''), patchType: 'react-css', eligible: true },
  { test: (i) => /^integrity:(feed-dedup|autoposter-dedup)$/.test(i.checkId || ''), patchType: 'feed-dedup-v2', eligible: true },
  { test: (i) => /^integrity:film-sources$/.test(i.checkId || ''), patchType: 'film-source-url', eligible: true },
  { test: (i) => /^integrity:(roster-data|depth-chart-data)$/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^crawler:(recruiting|roster|depth-chart|pressers|highlights)/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^content:film-room/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^content:team-module$/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  /* Retired monolith — never auto-patch */
  { test: (i) => /^pages:(team-hooks|film-room-hooks)$/.test(i.checkId || ''), patchType: null, eligible: false, reason: 'retired-monolith' },
  { test: (i) => /^integrity:(missing-content|filmroom-structure|team-history-structure|wrong-background|layout-overflow|panel-clipping)$/.test(i.checkId || ''), patchType: null, eligible: false, reason: 'retired-monolith' },
  { test: (i) => /mobile-behavior:team-tab-theme/.test(i.checkId || ''), patchType: null, eligible: false, reason: 'retired-monolith' },
  { test: (i) => /^mobile-behavior:navigation-back$/.test(i.checkId || ''), patchType: 'react-css', eligible: true },
  { test: (i) => /^mobile-behavior:feed-freshness$/.test(i.checkId || ''), patchType: 'feed-dedup-v2', eligible: true },
  { test: (i) => /^pages:admin-hub/.test(i.checkId || ''), patchType: 'react-component', eligible: true },
  { test: (i) => /^content:articles/.test(i.checkId || ''), patchType: 'schema-field-v2', eligible: true },
  { test: (i) => /^api:/.test(i.checkId || ''), patchType: null, eligible: false, reason: 'manual-api' }
];

const INELIGIBLE_MODULES = new Set(['api', 'browser']);

/** @deprecated — monolith HTML snippets removed in React architecture */
const HOOK_SNIPPETS = {};

/** @deprecated — use react-blueprint VAULT_ROUTES */
const TEAM_OVERVIEW_FILES = {
  shell: '../client/components/vault/VaultShell.tsx',
  pages: '../client/components/vault/VaultTeamPage.tsx',
  styles: '../client/lib/vault-shell.css'
};

const MODAL_OVERFLOW_CSS_SNIPPET = `
/* Self-Runner 3.0: React vault scroll + modal guards */
.gv-vault-shell__main { min-width: 0; }
.gv-hub-tabs--scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.gv-vault-bottom-nav { z-index: 55; }
`;

function resolvePatchType(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return null;
  const rule = ELIGIBILITY.find((r) => r.test(issue) && r.eligible !== false && r.patchType);
  return rule ? rule.patchType : null;
}

function isEligible(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return false;
  if (issue.manualOnly) return false;
  const retired = ELIGIBILITY.find((r) => r.test(issue) && r.eligible === false);
  if (retired) return false;
  return ELIGIBILITY.some((r) => r.test(issue) && r.eligible !== false);
}

function classifyIneligibility(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) {
    return { eligible: false, reason: 'ineligible_module', detail: issue.module };
  }
  const retired = ELIGIBILITY.find((r) => r.test(issue) && r.eligible === false);
  if (retired) {
    return { eligible: false, reason: retired.reason || 'retired_monolith', detail: issue.checkId };
  }
  if (issue.manualOnly) {
    return { eligible: false, reason: 'manual_only', detail: issue.manualReviewReason || 'flagged' };
  }
  const patchType = resolvePatchType(issue);
  if (!patchType) {
    return { eligible: false, reason: 'no_eligibility_rule', detail: issue.checkId || issue.id };
  }
  return { eligible: true, reason: 'matched', patchType };
}

function fallbackForUrl(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('nfl.com')) return FILM_SOURCE_FALLBACKS.nfl;
  if (u.includes('floridagators.com')) return FILM_SOURCE_FALLBACKS.florida;
  if (u.includes('on3.com')) return FILM_SOURCE_FALLBACKS.on3;
  if (u.includes('espn.com')) return FILM_SOURCE_FALLBACKS.espn;
  return FILM_SOURCE_FALLBACKS.default;
}

function absPath(rel) {
  return path.join(SERVER_ROOT, rel.replace(/^\//, ''));
}

function clientAbsPath(rel) {
  const clean = rel.replace(/^\.\.\/client\//, '').replace(/^client\//, '');
  return path.join(SERVER_ROOT, '..', 'client', clean);
}

/** @deprecated — monolith region classes removed in React architecture */
const TEAM_FORBIDDEN_IN_REGION = [];
const TEAM_REQUIRED = {};
const TEAM_LEGACY_CARD_SWAPS = {};

module.exports = {
  SERVER_ROOT,
  ELIGIBILITY,
  INELIGIBLE_MODULES,
  FILM_SOURCE_FALLBACKS,
  HOOK_SNIPPETS,
  TEAM_OVERVIEW_FILES,
  TEAM_FORBIDDEN_IN_REGION,
  TEAM_REQUIRED,
  TEAM_LEGACY_CARD_SWAPS,
  MODAL_OVERFLOW_CSS_SNIPPET,
  FORBIDDEN_EDIT_TYPES: reactBp.FORBIDDEN_EDIT_TYPES,
  FORBIDDEN_PATCH_FILES: reactBp.FORBIDDEN_PATCH_FILES,
  resolvePatchType,
  isEligible,
  classifyIneligibility,
  fallbackForUrl,
  absPath,
  clientAbsPath,
  getPatchTemplates: () => require('./self-runner-patch-templates')
};
