/**
 * Self-Runner — patch templates and eligibility rules.
 */
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..', '..');

const ELIGIBILITY = [
  {
    test: (issue) => /^visual-integrity:/.test(issue.checkId || ''),
    patchType: 'background-theme',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:feed-dedup',
    patchType: 'feed-dedup',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:film-sources',
    patchType: 'film-source-url',
    eligible: true
  },
  {
    test: (issue) => /^pages:(film-room-hooks|team-hooks)$/.test(issue.checkId || ''),
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^pages:admin-hub/.test(issue.checkId || ''),
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^ux:/.test(issue.checkId || ''),
    patchType: 'css-token',
    eligible: true
  }
];

const INELIGIBLE_MODULES = new Set(['api', 'browser', 'content']);

const FILM_SOURCE_FALLBACKS = {
  default: 'https://247sports.com/college/florida/',
  nfl: 'https://www.nfl.com/news/2026-nfl-scouting-combine-dates-times-how-to-watch-and-more',
  florida: 'https://floridagators.com/news/2025/12/19/football-gators-meet-brad-white-floridas-new-defensive-coordinator-southeastern-conference-florida-gators',
  on3: 'https://www.on3.com/college/florida-gators/',
  espn: 'https://www.espn.com/college-football/'
};

const HOOK_SNIPPETS = {
  'pages:team-hooks': {
    file: 'index.html',
    marker: 'gvOpenTeamDetail',
    insertBefore: '</body>',
    snippet:
      '\n<!-- self-runner: team hooks -->\n<script src="/js/gv-team-mobile.js?v=team-v3" defer></script>\n'
  },
  'pages:film-room-hooks': {
    file: 'index.html',
    marker: 'gvOpenVerifiedSource',
    insertBefore: '</body>',
    snippet:
      '\n<!-- self-runner: film room verified source hooks wired in gv-film-sources.js -->\n'
  }
};

const TEAM_FORBIDDEN_IN_REGION = [
  'trial-expired-ov',
  'pricing-sec',
  'text-amber-300',
  'from-amber',
  'bg-amber',
  'reg-modal'
];

const TEAM_REQUIRED = {
  'vpane-team': ['gv-team-page', 'gv-team-overview-layout'],
  'vpane-mteam': ['gv-team-page', 'gv-team-section']
};

function resolvePatchType(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return null;
  const rule = ELIGIBILITY.find((r) => r.test(issue));
  return rule ? rule.patchType : null;
}

function isEligible(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return false;
  if (issue.manualOnly) return false;
  return ELIGIBILITY.some((r) => r.test(issue));
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

module.exports = {
  SERVER_ROOT,
  ELIGIBILITY,
  FILM_SOURCE_FALLBACKS,
  HOOK_SNIPPETS,
  TEAM_FORBIDDEN_IN_REGION,
  TEAM_REQUIRED,
  resolvePatchType,
  isEligible,
  fallbackForUrl,
  absPath
};
