/**
 * Self-Runner — patch templates and eligibility rules.
 */
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..', '..');

function loadTemplates() {
  return require('./self-runner-patch-templates');
}

const ELIGIBILITY = [
  {
    test: (issue) => issue.checkId === 'visual-integrity:component-variants',
    patchType: 'component-variant',
    eligible: true
  },
  {
    test: (issue) => /^visual-integrity:(panel-clipping|layout-overflow)/.test(issue.checkId || ''),
    patchType: 'css-token',
    eligible: true
  },
  {
    test: (issue) => /^visual-integrity:/.test(issue.checkId || ''),
    patchType: 'background-theme',
    eligible: true
  },
  {
    test: (issue) => /^integrity:(layout-overflow|panel-clipping|wrong-background)$/.test(issue.checkId || ''),
    patchType: 'css-token',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:missing-content',
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:team-history-structure',
    patchType: 'team-content',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:filmroom-structure',
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^integrity:(feed-dedup|autoposter-dedup)$/.test(issue.checkId || ''),
    patchType: 'feed-dedup',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:film-sources',
    patchType: 'film-source-url',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:depth-chart',
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'integrity:roster-images',
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^pages:(film-room-hooks|team-hooks|home)/.test(issue.checkId || ''),
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^pages:admin-hub/.test(issue.checkId || ''),
    patchType: 'html-hook',
    eligible: true
  },
  {
    test: (issue) => /^mobile-behavior:/.test(issue.checkId || ''),
    patchType: 'background-theme',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'mobile-behavior:team-tab-theme',
    patchType: 'component-variant',
    eligible: true
  },
  {
    test: (issue) => issue.checkId === 'content:team-module',
    patchType: 'team-content',
    eligible: true
  },
  {
    test: (issue) => /^ux:/.test(issue.checkId || ''),
    patchType: 'css-token',
    eligible: true
  },
  {
    test: (issue) => !!loadTemplates().resolveRuleId(issue),
    patchType: null,
    eligible: true
  }
];

/** Only raw API health and browser automation remain manual-only */
const INELIGIBLE_MODULES = new Set(['api', 'browser']);

const FILM_SOURCE_FALLBACKS = {
  default: 'https://247sports.com/college/florida/',
  nfl: 'https://www.nfl.com/news/2026-nfl-scouting-combine-dates-times-how-to-watch-and-more',
  florida: 'https://floridagators.com/news/2025/12/19/football-gators-meet-brad-white-floridas-new-defensive-coordinator-southeastern-conference-florida-gators',
  on3: 'https://www.on3.com/college/florida-gators/',
  espn: 'https://www.espn.com/college-football/'
};

const HOOK_SNIPPETS = (() => {
  try {
    const bp = require('./blueprint/html-blueprint');
    const out = {};
    Object.entries(bp.HTML_HOOKS).forEach(([key, hook]) => {
      out[`pages:${key}`] = {
        file: hook.file || 'index.html',
        marker: hook.marker || hook.id || key,
        insertBefore: hook.anchor || '</body>',
        snippet: hook.snippet
      };
    });
    out['pages:team-hooks'] = {
      file: 'index.html',
      marker: 'gvOpenTeamDetail',
      insertBefore: '</body>',
      snippet: bp.HTML_HOOKS['gvOpenTeamDetail']?.snippet || '<script src="/js/gv-team-mobile.js?v=team-v3" defer></script>\n'
    };
    out['pages:film-room-hooks'] = {
      file: 'index.html',
      marker: 'gvOpenVerifiedSource',
      insertBefore: '</body>',
      snippet: bp.HTML_HOOKS['gvOpenVerifiedSource']?.snippet || '<script src="/js/gv-film-sources.js?v=film-v2" defer></script>\n'
    };
    out['integrity:filmroom-structure'] = {
      file: 'index.html',
      marker: 'film-room-hub-landing',
      insertBefore: 'id="vpane-highlights"',
      snippet: bp.HTML_HOOKS['film-room-hub-landing']?.snippet || '<div id="film-room-hub-landing" class="film-room-hub-landing"></div>\n'
    };
    out['integrity:missing-content'] = {
      file: 'index.html',
      marker: 'gv-team-overview-layout',
      insertBefore: 'id="vpane-team"',
      snippet: bp.HTML_HOOKS['gv-team-overview-layout']?.snippet || '<div class="gv-team-overview-layout"></div>\n'
    };
    return out;
  } catch {
    return {};
  }
})();

const TEAM_LEGACY_CARD_SWAPS = {
  'card-h': 'gv-team-era-card',
  'bg-surface-700': 'gv-team-section',
  'rounded-2xl': 'gv-team-era-card'
};

const TEAM_FORBIDDEN_IN_REGION = [
  'trial-expired-ov',
  'trial-payment-banner',
  'pricing-sec',
  'text-amber-300',
  'from-amber',
  'bg-amber',
  'reg-modal',
  'faq-btn',
  'card-h'
];

const TEAM_REQUIRED = {
  'vpane-team': ['gv-team-page', 'gv-team-overview-layout'],
  'vpane-mteam': ['gv-team-page', 'gv-team-section']
};

/** Team Overview lives in legacy-index.html (#vpane-team / #vpane-mteam) + gv-team-mobile.js card renders */
const TEAM_OVERVIEW_FILES = {
  shell: 'legacy-index.html',
  cards: 'js/gv-team-mobile.js',
  styles: 'css/gv-team.css'
};

const MODAL_OVERFLOW_CSS_SNIPPET = `
/* Self-Runner 2.0: modal overflow guards */
.gv-team-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: break-word;
}
.gv-tm-lead, .gv-tm-body, .gv-tm-highlight-text, .gv-tm-timeline-item {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: break-word;
}
.gv-team-overview-main { min-width: 0; }
`;

function resolvePatchType(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return null;
  const tmpl = loadTemplates().getTemplate(issue);
  if (tmpl) return tmpl.patchType;
  const rule = ELIGIBILITY.find((r) => r.test(issue) && r.patchType);
  return rule ? rule.patchType : null;
}

function isEligible(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) return false;
  if (issue.manualOnly) return false;
  if (loadTemplates().resolveRuleId(issue)) return true;
  return ELIGIBILITY.some((r) => r.test(issue) && r.eligible !== false);
}

function classifyIneligibility(issue) {
  if (INELIGIBLE_MODULES.has(issue.module)) {
    return { eligible: false, reason: 'ineligible_module', detail: issue.module };
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

module.exports = {
  SERVER_ROOT,
  ELIGIBILITY,
  FILM_SOURCE_FALLBACKS,
  HOOK_SNIPPETS,
  TEAM_FORBIDDEN_IN_REGION,
  TEAM_REQUIRED,
  TEAM_LEGACY_CARD_SWAPS,
  TEAM_OVERVIEW_FILES,
  MODAL_OVERFLOW_CSS_SNIPPET,
  resolvePatchType,
  isEligible,
  classifyIneligibility,
  fallbackForUrl,
  absPath,
  getPatchTemplates: () => require('./self-runner-patch-templates')
};
