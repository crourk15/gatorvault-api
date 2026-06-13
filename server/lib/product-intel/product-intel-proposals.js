/**
 * Product Intelligence — Proposal Engine (Section 1 Layer 4 + Section 4).
 * Generates fix description, files, test plan, QA steps, rollback plan.
 */
const classifier = require('./product-intel-classifier');
const patches = require('../self-runner/self-runner-patches');
const patchTemplates = require('../self-runner/self-runner-patch-templates');

const FILE_MAP = {
  'layout-overflow': ['client/lib/vault-shell.css'],
  'panel-clipping': ['client/lib/vault-shell.css', 'client/components/vault/VaultShell.tsx'],
  'missing-content': ['client/components/vault/', 'data/coaching-staff.json'],
  'missing-image': ['data/roster/', 'api/roster/players'],
  'wrong-background': ['client/lib/vault-shell.css', 'client/components/vault/VaultTeamPage.tsx'],
  'wrong-ordering': ['client/components/vault/VaultTeamPage.tsx', 'data/roster/depth-chart-meta.json'],
  'filmroom-structure': ['client/components/vault/VaultFilmRoomPage.tsx'],
  'team-history-structure': ['client/components/vault/VaultTeamPage.tsx'],
  'team-identity-layering': ['client/lib/vault-shell.css', 'client/components/vault/VaultTeamPage.tsx'],
  'autoposter-duplication': ['data/live/feed-items.json'],
  'autoposter-stale': ['lib/x-autoposter.js', 'data/live/feed-items.json'],
  'recruiting-board-mismatch': ['data/recruiting/', 'lib/recruiting-store.js'],
  'depth-chart-mismatch': ['data/roster/depth-chart-meta.json', 'client/components/vault/VaultTeamPage.tsx'],
  'roster-mismatch': ['data/roster/', 'lib/roster-store.js'],
  'pressers-missing': ['client/components/vault/VaultFilmRoomPage.tsx'],
  'highlights-missing': ['client/components/vault/VaultFilmRoomPage.tsx'],
  'api-latency': ['server.js', 'Render dashboard'],
  'cache-stale': ['lib/live-dashboard-cache.js', 'lib/live-routes.js'],
  'broken-link': ['data/film-room-knowledge/', 'data/articles/'],
  '404-detected': ['client/lib/routes.js', 'vault/'],
  'ui-regression': ['client/components/vault/', 'client/lib/vault-shell.css'],
  'mobile-desktop-divergence': ['client/lib/vault-shell.css', 'client/components/vault/VaultShell.tsx'],
  'retired-monolith': ['client/components/vault/']
};

function buildTestPlan(classification, checkId) {
  const base = [
    'Run QA crawl: node server/scripts/run-qa-crawler.js',
    'Verify Product Intelligence fix queue clears for this issue',
    'Generate Self-Runner proposal and confirm patch preview'
  ];
  const specific = {
    'layout-overflow': [
      'Desktop: Team → Program History → open each era modal',
      'Confirm full text visible — no right-side or bottom clipping',
      'Confirm modal body scrolls vertically on desktop'
    ],
    'panel-clipping': [
      'Desktop: open Program History modal for 2020–Present',
      'Verify Team Identity panel does not overlap modal text',
      'Check z-index stacking on modal toolbar and body'
    ],
    'missing-content': [
      'Team tab: verify Program History, Identity, Achievements render',
      'Film Room: verify all 5 hub categories appear',
      'Recruiting Board: verify players load with name + position'
    ],
    'team-history-structure': [
      'Open all 5 era cards — 70s, 90s, 2000s, 2010s, 2020–Present',
      'Verify Spurrier appears only in 1990–2001 era',
      'Verify coaching, milestones, schemes sections present'
    ],
    'filmroom-structure': [
      'Film Room → tap each category card',
      'Verify drill-down content loads',
      'Verify verified source modal opens from knowledge engine'
    ],
    'autoposter-duplication': [
      'Run validateFeedIntegrity() on data/live/feed-items.json',
      'Apply repairFeedItems() — SHA-256 normalized hashes',
      'Verify integrity:autoposter-dedup QA check passes'
    ],
    'autoposter-stale': [
      'Latest Updates: confirm post within last 6 hours during active window',
      'Check autoposter logs on Render',
      'Force refresh via admin if needed'
    ],
    'cache-stale': [
      'GET /api/live/dashboard — verify cache age <45s',
      'GET /api/live/pipeline/health — no stale flags',
      'Mobile Home tab: confirm feed refreshes on focus'
    ],
    'api-latency': [
      'GET /api/ping — response <500ms',
      'GET /api/live/dashboard — response <1s',
      'Check Render metrics for cold starts'
    ]
  };
  return [...(specific[classification] || []), ...base];
}

function buildQaSteps(classification, checkId) {
  return [
    `QA check: ${checkId || classification}`,
    'POST /api/product-intel/recompute — verify issue resolved',
    'POST /api/self-runner/generate — confirm no new proposal for same checkId',
    'Admin → Product Intelligence — severity score should drop'
  ];
}

function buildRollbackPlan(classification, files) {
  return {
    strategy: 'git-revert',
    steps: [
      `Revert modified files: ${(files || []).join(', ') || 'see patch'}`,
      'Redeploy static site (Netlify) and API (Render) if needed',
      'POST /api/product-intel/recompute to restore prior health score',
      'Re-open fix queue item if rollback was intentional'
    ],
    note: 'Self-Runner validation runs QA after apply — failed validation auto-marks fix as failed'
  };
}

function buildProposalMetadata(issue, checkDetails) {
  const classified = classifier.classifyCheck({ id: issue.checkId, module: issue.module });
  const classification = issue.classification || classified.classification;
  const ruleId = issue.ruleId || classified.ruleId;
  const category = issue.category || classified.category;

  const tmpl = patchTemplates.applyTemplate(
    { ...issue, classification, ruleId, category },
    checkDetails || { details: issue.details }
  );

  const files =
    tmpl?.files ||
    FILE_MAP[classification] ||
    (patches.TEAM_OVERVIEW_FILES
      ? [patches.TEAM_OVERVIEW_FILES.shell, patches.TEAM_OVERVIEW_FILES.styles, patches.TEAM_OVERVIEW_FILES.cards]
      : ['index.html']);

  const patchType = tmpl?.patchType || patches.resolvePatchType(issue) || 'css-token';
  const description = tmpl?.description || issue.suggestedFix || issue.title || `Fix ${classification} issue (${ruleId})`;

  const testPlan = tmpl?.testPlan || buildTestPlan(classification, issue.checkId);
  const qaSteps = tmpl?.qaSteps || buildQaSteps(classification, issue.checkId);
  const rollbackPlan = tmpl?.rollbackPlan || buildRollbackPlan(classification, files);

  const codeDiffHint =
    (classification === 'autoposter-duplication'
      ? 'validateFeedIntegrity() → repairFeedItems() — real SHA-256 hashes on feed-items.json'
      : null) ||
    tmpl?.diff?.[0]?.after ||
    {
      'layout-overflow': 'Add min-height:0, overflow-y:auto, overflow-wrap:break-word to .gv-team-modal-body and text blocks in gv-team.css',
      'panel-clipping': 'Add min-width:0, z-index:3 on modal body; minmax(0,1fr) on overview grid',
      'team-history-structure': 'Update ERAS array in gv-team-mobile.js — ensure 5 complete eras',
      'filmroom-structure': 'Wire film-room-hub-landing + GV_FILM_HUB_DESC + gvOpenFilmRoomHub in index.html',
      'autoposter-duplication': 'repairFeedItems() via validateFeedIntegrity() — SHA-256 hashes, keep newest',
      'wrong-background': 'Replace og-image.jpg with era gradient classes on Team Identity banner'
    }[classification] ||
    description;

  return {
    title: issue.title || `[${ruleId}] ${classification}`,
    description,
    classification,
    ruleId,
    category,
    filesToModify: files,
    patchType,
    codeDiffHint,
    codeDiff: tmpl?.diff || null,
    safetyRules: tmpl?.safetyRules || [],
    testPlan,
    qaSteps,
    rollbackPlan,
    approvalGate: {
      steps: ['Apply patch', 'Optional redeploy', 'QA crawl', 'Product Health recompute', 'Mark completed']
    }
  };
}

module.exports = {
  buildProposalMetadata,
  buildTestPlan,
  buildQaSteps,
  buildRollbackPlan,
  FILE_MAP,
  patchTemplates
};
