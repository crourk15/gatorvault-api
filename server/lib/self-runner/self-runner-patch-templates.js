/**
 * Self-Runner — patch templates grouped by issue category (Blueprint A–F).
 * Each template: metadata, files, diff structure, safety rules, QA steps, rollback.
 */

const TEAM_OVERVIEW_FILES = {
  shell: 'index.html',
  cards: 'js/gv-team-mobile.js',
  styles: 'css/gv-team.css'
};

/** Source-of-truth templates keyed by rule ID */
const PATCH_TEMPLATES = {
  A1: {
    ruleId: 'A1',
    category: 'A',
    classification: 'layout-overflow',
    patchType: 'layout-overflow',
    description: 'Fix overflow/clipping in {{section}} by enabling scroll or auto-expansion.',
    files: ['{{file}}'],
    diff: [
      {
        file: '{{file}}',
        before: '{{selector}} { overflow: hidden; }',
        after: '{{selector}} { overflow-y: auto; max-height: none; min-height: 0; min-width: 0; }'
      }
    ],
    safetyRules: [
      'Never remove min-width:0 or min-height:0 from modal flex children',
      'Only modify overflow on the targeted selector — do not change global body overflow',
      'Preserve mobile scroll behavior — test 390px viewport after apply',
      'Max 1 CSS file per patch unless issue spans shell + styles'
    ],
    qa: [
      'Load {{page}}',
      'Verify full text is visible',
      'Verify no clipping on right or bottom',
      'Verify mobile layout unchanged'
    ],
    rollback: 'Restore previous overflow rules if regression detected.'
  },
  A2: {
    ruleId: 'A2',
    category: 'A',
    classification: 'panel-clipping',
    patchType: 'panel-layering',
    description: 'Correct z-index and layering for {{panel}} to prevent clipping.',
    files: ['{{file}}'],
    diff: [
      {
        file: '{{file}}',
        before: '{{selector}} { z-index: {{oldZIndex}}; }',
        after: '{{selector}} { z-index: {{newZIndex}}; position: relative; }'
      }
    ],
    safetyRules: [
      'Do not set z-index above modal overlay (9999) unless fixing modal stack',
      'Verify Team Identity panel does not cover Program History modal text',
      'Test Film Room header does not overlap category cards',
      'Preserve pointer-events on interactive elements'
    ],
    qa: [
      'Load {{page}}',
      'Verify text is fully visible',
      'Verify background no longer overlaps content'
    ],
    rollback: 'Restore previous z-index if layering breaks other sections.'
  },
  A3: {
    ruleId: 'A3',
    category: 'A',
    classification: 'wrong-background',
    patchType: 'background-theme',
    description: 'Fix incorrect background theme for {{section}}.',
    files: ['{{file}}'],
    diff: [
      {
        file: '{{file}}',
        before: '{{selector}} { background: {{oldTheme}}; }',
        after: '{{selector}} { background: {{correctTheme}}; }'
      }
    ],
    safetyRules: [
      'Never use og-image.jpg as Team Identity background',
      'Use era gradient classes (.era-70s, .era-90s, etc.) — not trial/pricing tokens',
      'Verify text contrast remains WCAG-readable after theme change',
      'Do not modify pricing or trial modal backgrounds'
    ],
    qa: [
      'Load {{page}}',
      'Verify correct gradient/theme is applied',
      'Verify text contrast remains readable'
    ],
    rollback: 'Restore previous background if theme mismatch occurs.'
  },
  A4: {
    ruleId: 'A4',
    category: 'A',
    classification: 'mobile-desktop-divergence',
    patchType: 'layout-overflow',
    description: 'Align mobile and desktop layout for {{section}}.',
    files: ['css/gv-team.css', 'index.html'],
    diff: [
      {
        file: 'css/gv-team.css',
        before: '/* viewport-specific overflow mismatch */',
        after: '/* unified overflow + scroll rules for desktop and mobile */'
      }
    ],
    safetyRules: [
      'Apply symmetric rules to #vpane-team and #vpane-mteam where applicable',
      'Do not break mobile-only bottom nav spacing',
      'Test both 1280px and 390px viewports'
    ],
    qa: [
      'Load {{page}} on desktop — verify no clipping',
      'Load {{page}} on mobile — verify scroll works',
      'Compare overflow state across viewports'
    ],
    rollback: 'Restore viewport-specific rules if mobile layout regresses.'
  },
  B1: {
    ruleId: 'B1',
    category: 'B',
    classification: 'missing-content',
    patchType: 'missing-content',
    description: 'Restore missing content for {{section}}.',
    files: ['{{file}}'],
    diff: [
      {
        file: '{{file}}',
        before: '{{selector}}',
        after: '{{selector}} {{insertContent}}'
      }
    ],
    safetyRules: [
      'Never duplicate existing section markers or IDs',
      'Insert content adjacent to surrounding sections — match formatting',
      'Verify hooks are wired before adding visible markup',
      'Do not remove existing era/card data when restoring'
    ],
    qa: [
      'Load {{page}}',
      'Verify content appears',
      'Verify formatting matches surrounding sections'
    ],
    rollback: 'Remove inserted content if duplication occurs.'
  },
  B2: {
    ruleId: 'B2',
    category: 'B',
    classification: 'wrong-ordering',
    patchType: 'ordering-fix',
    description: 'Correct ordering for {{section}}.',
    files: ['{{file}}'],
    diff: [
      {
        file: '{{file}}',
        before: '{{oldOrder}}',
        after: '{{newOrder}}'
      }
    ],
    safetyRules: [
      'Preserve all items — reorder only, do not delete entries',
      'Film Room: Scheme → Breakdown → Press → Highlights',
      'Program History: chronological era order',
      'Depth Chart: starters before backups within position group'
    ],
    qa: [
      'Load {{page}}',
      'Verify ordering matches expected sequence',
      'Verify mobile and desktop match'
    ],
    rollback: 'Restore previous ordering if regression detected.'
  },
  C1: {
    ruleId: 'C1',
    category: 'C',
    classification: 'autoposter-duplication',
    patchType: 'autoposter-dedup',
    description: 'Add dedupe rule for {{intel}}.',
    files: ['data/live/feed-items.json', 'lib/live-aggregator.js'],
    diff: [
      {
        file: 'lib/live-aggregator.js',
        before: '// existing dedupe rules',
        after: "addDedupeRule({ hash: '{{hash}}', window: 21600 });"
      }
    ],
    safetyRules: [
      'Dedupe window minimum 1 hour — never block all posts',
      'Keep newest item when duplicates detected',
      'Hash normalized text — ignore punctuation differences',
      'Unique intel must still post after dedupe apply'
    ],
    qa: [
      'Simulate ingest of duplicate intel',
      'Verify autoposter skips duplicates',
      'Verify unique intel still posts'
    ],
    rollback: 'Remove dedupe rule if false positives occur.'
  },
  C2: {
    ruleId: 'C2',
    category: 'C',
    classification: 'autoposter-duplication',
    patchType: 'similarity-filter',
    description: 'Add similarity filter for {{intel}}.',
    files: ['lib/live-aggregator.js'],
    diff: [
      {
        file: 'lib/live-aggregator.js',
        before: 'SIMILARITY_THRESHOLD = 0.85',
        after: 'SIMILARITY_THRESHOLD = 0.80'
      }
    ],
    safetyRules: [
      'Do not set threshold below 0.75 — too aggressive',
      'Test with two genuinely distinct posts before deploy',
      'Log skipped posts for ops review',
      'Never delete feed history — filter at ingest only'
    ],
    qa: [
      'Test two similar posts',
      'Verify only one posts',
      'Verify distinct intel still posts'
    ],
    rollback: 'Restore threshold if filtering becomes too aggressive.'
  },
  C4: {
    ruleId: 'C4',
    category: 'C',
    classification: 'autoposter-stale',
    patchType: 'autoposter-dedup',
    description: 'Restore autoposter activity for {{section}}.',
    files: ['lib/x-autoposter.js', 'data/live/feed-items.json'],
    diff: [
      {
        file: 'lib/x-autoposter.js',
        before: '// stale autoposter config',
        after: '// verify cron + ingest pipeline active'
      }
    ],
    safetyRules: [
      'Do not duplicate posts when forcing refresh',
      'Verify UF-only filter still active after restart',
      'Check Render cron env vars before code changes'
    ],
    qa: [
      'Verify post within 6h during active window',
      'Check autoposter logs on Render',
      'Latest Updates shows fresh intel'
    ],
    rollback: 'Revert autoposter config if duplicate spike occurs.'
  },
  D1: {
    ruleId: 'D1',
    category: 'D',
    classification: 'recruiting-board-mismatch',
    patchType: 'recruiting-board-sync',
    description: 'Fix mismatch for {{player}} on Recruiting Board.',
    files: ['data/recruiting/board.json'],
    diff: [
      {
        file: 'data/recruiting/board.json',
        before: '{{oldEntry}}',
        after: '{{correctEntry}}'
      }
    ],
    safetyRules: [
      'Verify player against master recruiting DB before edit',
      'Never remove committed players without explicit flag',
      'Stars must be 0–5; position must match roster enum',
      'Dedupe by player id — not display name alone'
    ],
    qa: [
      'Load Recruiting Board',
      'Verify player appears correctly',
      'Verify ordering and ranking correct'
    ],
    rollback: 'Restore previous entry if data mismatch occurs.'
  },
  D2: {
    ruleId: 'D2',
    category: 'D',
    classification: 'recruiting-board-mismatch',
    patchType: 'recruiting-board-sync',
    description: 'Restore War Room UI for {{section}}.',
    files: ['index.html', 'data/recruiting/'],
    diff: [
      {
        file: 'index.html',
        before: '<!-- war room markers missing -->',
        after: '<!-- war room: notes, confidence meter, heat meter -->'
      }
    ],
    safetyRules: [
      'Do not expose internal scout notes to public UI',
      'Heat/confidence meters must use existing design tokens',
      'Wire API /api/war-room/breakdowns before UI markers'
    ],
    qa: [
      'Load Recruiting → War Room',
      'Verify notes, confidence, and heat meters render',
      'Verify API data loads'
    ],
    rollback: 'Remove War Room markers if API data unavailable.'
  },
  E1: {
    ruleId: 'E1',
    category: 'E',
    classification: 'roster-mismatch',
    patchType: 'roster-sync',
    description: 'Correct roster entry for {{player}}.',
    files: ['data/roster/players.json'],
    diff: [
      {
        file: 'data/roster/players.json',
        before: '{{oldEntry}}',
        after: '{{newEntry}}'
      }
    ],
    safetyRules: [
      'Jersey numbers 0–99 only',
      'Verify against official roster before edit',
      'Never remove starters without depth chart update',
      'Class year must match NCAA eligibility enum'
    ],
    qa: [
      'Load Roster page',
      'Verify player info correct',
      'Verify ordering unchanged'
    ],
    rollback: 'Restore previous roster entry if needed.'
  },
  E2: {
    ruleId: 'E2',
    category: 'E',
    classification: 'depth-chart-mismatch',
    patchType: 'ordering-fix',
    description: 'Fix depth chart ordering for {{section}}.',
    files: ['data/roster/depth-chart-meta.json', 'index.html'],
    diff: [
      {
        file: 'index.html',
        before: '{{oldOrder}}',
        after: '{{newOrder}}'
      }
    ],
    safetyRules: [
      'Starters before backups within each position group',
      'Do not remove position groups — reorder only',
      'Sync with roster API after depth chart edit'
    ],
    qa: [
      'Load Team → Depth Chart',
      'Verify starter/backup order per position',
      'Verify all positions populated'
    ],
    rollback: 'Restore previous depth chart if ordering regresses.'
  },
  F1: {
    ruleId: 'F1',
    category: 'F',
    classification: 'api-latency',
    patchType: 'api-latency',
    description: 'Optimize API latency for {{endpoint}}.',
    files: ['lib/{{file}}'],
    diff: [
      {
        file: 'lib/{{file}}',
        before: '{{slowCode}}',
        after: '{{optimizedCode}}'
      }
    ],
    safetyRules: [
      'Measure latency before and after — target <500ms for ping',
      'Do not remove error handling when optimizing',
      'Cache warming must not serve stale data >45s for live dashboard',
      'Load test on Render cold start before merge'
    ],
    qa: [
      'Measure latency before and after',
      'Verify response <500ms',
      'Verify no errors introduced'
    ],
    rollback: 'Restore previous code if latency worsens.'
  },
  F2: {
    ruleId: 'F2',
    category: 'F',
    classification: 'cache-stale',
    patchType: 'api-latency',
    description: 'Refresh stale cache for {{endpoint}}.',
    files: ['lib/live-dashboard-cache.js', 'lib/live-routes.js'],
    diff: [
      {
        file: 'lib/live-dashboard-cache.js',
        before: 'CACHE_TTL_MS = {{oldTtl}}',
        after: 'CACHE_TTL_MS = {{newTtl}}'
      }
    ],
    safetyRules: [
      'Live dashboard cache max 45s; recruiting cache max 5min',
      'Do not disable cache entirely — adjust TTL only',
      'Verify ingest cron runs after TTL change'
    ],
    qa: [
      'GET /api/live/dashboard — cache age <45s',
      'GET /api/recruiting/board — refreshed within 5min',
      'Verify no 502 during cache refresh'
    ],
    rollback: 'Restore previous TTL if error rate increases.'
  },
  F3: {
    ruleId: 'F3',
    category: 'F',
    classification: '404-detected',
    patchType: 'html-hook',
    description: 'Fix broken asset or link: {{selector}}.',
    files: ['index.html'],
    diff: [
      {
        file: 'index.html',
        before: '{{brokenPath}}',
        after: '{{fixedPath}}'
      }
    ],
    safetyRules: [
      'Verify asset exists locally before updating production path',
      'Use HEAD request to confirm 200 on production',
      'Do not redirect external links without verification'
    ],
    qa: [
      'Load {{page}} — no 404 in network tab',
      'Verify asset renders correctly',
      'Run crawler:404 check passes'
    ],
    rollback: 'Restore previous asset path if new path fails.'
  }
};

/** Map classification → template rule ID (fallback when ruleId absent) */
const CLASSIFICATION_TO_RULE = {
  'layout-overflow': 'A1',
  'panel-clipping': 'A2',
  'team-identity-layering': 'A2',
  'wrong-background': 'A3',
  'mobile-desktop-divergence': 'A4',
  'ui-regression': 'A1',
  'missing-content': 'B1',
  'pressers-missing': 'B1',
  'highlights-missing': 'B1',
  'filmroom-structure': 'B1',
  'team-history-structure': 'B1',
  'wrong-ordering': 'B2',
  'depth-chart-mismatch': 'E2',
  'autoposter-duplication': 'C1',
  'autoposter-stale': 'C4',
  'recruiting-board-mismatch': 'D1',
  'roster-mismatch': 'E1',
  'api-latency': 'F1',
  'cache-stale': 'F2',
  '404-detected': 'F3',
  'broken-link': 'F3',
  'missing-image': 'F3'
};

/** Map checkId patterns → rule ID */
const CHECK_ID_RULES = [
  { re: /^crawler:overflow|integrity:layout-overflow|visual-integrity:layout-overflow|ux:(scroll-containers|overflow-visible)/, ruleId: 'A1' },
  { re: /^crawler:layering|integrity:panel-clipping|visual-integrity:panel-clipping|ux:modal-zindex|mobile-behavior:team-tab-theme/, ruleId: 'A2' },
  { re: /^crawler:background|integrity:wrong-background|visual-integrity:(team-overview-background|cross-page-contamination|film-room-theme)/, ruleId: 'A3' },
  { re: /^crawler:viewport-divergence|mobile-behavior:stale-html/, ruleId: 'A4' },
  { re: /^crawler:(missing-content|pressers-missing|highlights-missing)|integrity:(missing-content|filmroom-structure|team-history-structure)|pages:(team-hooks|film-room-hooks)/, ruleId: 'B1' },
  { re: /^crawler:wrong-ordering|integrity:depth-chart/, ruleId: 'B2' },
  { re: /^crawler:autoposter-dup|integrity:(feed-dedup|autoposter-dedup)/, ruleId: 'C1' },
  { re: /^crawler:autoposter-similarity/, ruleId: 'C2' },
  { re: /^crawler:autoposter-stale|integrity:live-freshness|mobile-behavior:feed-freshness/, ruleId: 'C4' },
  { re: /^crawler:recruiting-mismatch|integrity:rankings|api:recruiting-board/, ruleId: 'D1' },
  { re: /^crawler:war-room|api:war-room-breakdowns/, ruleId: 'D2' },
  { re: /^crawler:roster-mismatch|integrity:roster-images|api:roster-players/, ruleId: 'E1' },
  { re: /^crawler:depth-chart/, ruleId: 'E2' },
  { re: /^crawler:api-latency|api:ping/, ruleId: 'F1' },
  { re: /^crawler:cache-stale|api:(live-dashboard|live-pipeline-health)/, ruleId: 'F2' },
  { re: /^crawler:404|integrity:(article-links|film-sources)/, ruleId: 'F3' }
];

const DEFAULT_CONTEXT = {
  section: 'Team Overview',
  panel: 'Program History modal',
  page: '/',
  file: 'css/gv-team.css',
  selector: '.gv-team-modal-body',
  oldZIndex: '1',
  newZIndex: '3',
  oldTheme: 'og-image.jpg',
  correctTheme: 'var(--gv-team-era-gradient)',
  insertContent: '/* restored section content */',
  oldOrder: '/* incorrect order */',
  newOrder: '/* corrected order */',
  intel: 'duplicate feed item',
  hash: null,
  player: 'Unknown Player',
  oldEntry: '{}',
  correctEntry: '{}',
  oldEntryRoster: '{}',
  newEntry: '{}',
  endpoint: '/api/ping',
  slowCode: '/* unoptimized handler */',
  optimizedCode: '/* cached response */',
  brokenPath: '/missing/asset.css',
  fixedPath: '/css/gv-team.css'
};

function fillString(str, ctx) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (ctx[key] != null ? String(ctx[key]) : `{{${key}}}`));
}

function fillDeep(obj, ctx) {
  if (Array.isArray(obj)) return obj.map((item) => fillDeep(item, ctx));
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      out[k] = fillDeep(v, ctx);
    });
    return out;
  }
  if (typeof obj === 'string') return fillString(obj, ctx);
  return obj;
}

function resolveRuleId(issue) {
  if (issue.ruleId && PATCH_TEMPLATES[issue.ruleId]) return issue.ruleId;
  if (issue.classification && CLASSIFICATION_TO_RULE[issue.classification]) {
    return CLASSIFICATION_TO_RULE[issue.classification];
  }
  const checkId = issue.checkId || issue.id || '';
  const hit = CHECK_ID_RULES.find((r) => r.re.test(checkId));
  return hit ? hit.ruleId : null;
}

function buildContext(issue, checkDetails) {
  const details = checkDetails?.details || issue.details || {};
  const detailArr = Array.isArray(details) ? details : [details].filter(Boolean);
  const first = detailArr[0] || {};

  const sectionMap = {
    'team-overview': 'Team Overview',
    'program-history': 'Program History',
    'film-room': 'Film Room',
    recruiting: 'Recruiting',
    roster: 'Roster',
    'depth-chart': 'Depth Chart',
    homepage: 'Homepage',
    'press-conferences': 'Press Conferences',
    highlights: 'Highlights'
  };

  const sectionId = first.sectionId || first.section || issue.sectionId || 'team-overview';
  const selector = first.selector || first.domPath || first.missing || '.gv-team-modal-body';

  let file = 'css/gv-team.css';
  if (/film-room|highlights|pressers|missing-content|filmroom|hooks|404|ordering/.test(issue.checkId || '')) {
    file = 'index.html';
  } else if (/team-history|team-content|ordering|era/.test(issue.checkId || '')) {
    file = TEAM_OVERVIEW_FILES.cards;
  } else if (/feed-dedup|autoposter|stale-content/.test(issue.checkId || '')) {
    file = 'data/live/feed-items.json';
  } else if (/recruiting|war-room/.test(issue.checkId || '')) {
    file = 'data/recruiting/board.json';
  } else if (/roster/.test(issue.checkId || '')) {
    file = 'data/roster/players.json';
  } else if (/api-latency|cache/.test(issue.checkId || '')) {
    file = 'live-routes.js';
  }

  return {
    ...DEFAULT_CONTEXT,
    section: sectionMap[sectionId] || sectionId,
    panel: first.panel || `${sectionMap[sectionId] || sectionId} panel`,
    page: issue.url ? new URL(issue.url, 'https://gatorvaultinsider.com').pathname : '/',
    file,
    selector,
    oldZIndex: first.oldZIndex || '1',
    newZIndex: first.newZIndex || '3',
    oldTheme: first.pattern || first.oldTheme || 'og-image.jpg',
    correctTheme: first.correctTheme || 'var(--gv-team-era-gradient)',
    insertContent: first.insertContent || first.missing || '/* restored content */',
    oldOrder: first.oldOrder || JSON.stringify(first.indices || 'incorrect order'),
    newOrder: first.newOrder || 'corrected sequence',
    intel: first.title || first.message || issue.title || 'duplicate intel',
    hash: first.hash && String(first.hash).length >= 32 ? first.hash : null,
    player: first.name || first.player || issue.title || 'player',
    oldEntry: JSON.stringify(first.old || first.duplicate || '{}'),
    correctEntry: JSON.stringify(first.correct || first.expected || '{}'),
    newEntry: JSON.stringify(first.new || first.expected || '{}'),
    endpoint: first.endpoint || first.selector || '/api/ping',
    brokenPath: first.url || first.selector || '/missing/asset',
    fixedPath: first.fallback || '/css/gv-team.css',
    slowCode: '/* handler without cache */',
    optimizedCode: '/* cached + warmed response */',
    oldTtl: '120000',
    newTtl: '45000'
  };
}

function getTemplate(issue) {
  const ruleId = resolveRuleId(issue);
  return ruleId ? PATCH_TEMPLATES[ruleId] : null;
}

function applyTemplate(issue, checkDetails) {
  const template = getTemplate(issue);
  if (!template) return null;

  const ctx = buildContext(issue, checkDetails);
  const filled = fillDeep(template, ctx);

  return {
    ruleId: filled.ruleId,
    category: filled.category,
    classification: filled.classification,
    patchType: filled.patchType,
    description: filled.description,
    files: filled.files,
    diff: filled.diff,
    safetyRules: filled.safetyRules,
    qa: filled.qa,
    rollback: filled.rollback,
    rollbackPlan: {
      strategy: 'git-revert',
      summary: filled.rollback,
      steps: [
        `Revert: ${filled.files.join(', ')}`,
        'Redeploy Netlify (static) and Render (API) if needed',
        'POST /api/product-intel/recompute',
        'POST /api/qa/run — verify check passes'
      ]
    },
    testPlan: filled.qa,
    qaSteps: [
      ...filled.qa,
      `Verify QA check ${issue.checkId || filled.ruleId} passes`,
      'POST /api/product-intel/recompute — issue cleared from fix queue'
    ],
    context: ctx
  };
}

function templatesByCategory() {
  const grouped = { A: [], B: [], C: [], D: [], E: [], F: [] };
  Object.values(PATCH_TEMPLATES).forEach((t) => {
    if (grouped[t.category]) grouped[t.category].push(t.ruleId);
  });
  return grouped;
}

module.exports = {
  PATCH_TEMPLATES,
  CLASSIFICATION_TO_RULE,
  CHECK_ID_RULES,
  resolveRuleId,
  getTemplate,
  applyTemplate,
  buildContext,
  fillDeep,
  templatesByCategory
};
