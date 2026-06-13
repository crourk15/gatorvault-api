/**
 * Product Intelligence — Classification Layer (Section 1 Layer 2).
 * Maps QA checks and data signals → blueprint classification + rule ID.
 */
const fs = require('fs');
const path = require('path');

const RULES_PATH = path.join(__dirname, 'product-intel-rules.json');

function loadRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
}

/** Direct checkId → classification overrides */
const CHECK_MAP = {
  'integrity:layout-overflow': { classification: 'layout-overflow', ruleId: 'A1', category: 'A' },
  'visual-integrity:layout-overflow': { classification: 'layout-overflow', ruleId: 'A1', category: 'A' },
  'integrity:panel-clipping': { classification: 'panel-clipping', ruleId: 'A2', category: 'A' },
  'visual-integrity:panel-clipping': { classification: 'panel-clipping', ruleId: 'A2', category: 'A' },
  'integrity:wrong-background': { classification: 'wrong-background', ruleId: 'A3', category: 'A' },
  'visual-integrity:team-overview-background': { classification: 'wrong-background', ruleId: 'A3', category: 'A' },
  'visual-integrity:cross-page-contamination': { classification: 'wrong-background', ruleId: 'A3', category: 'A' },
  'integrity:missing-content': { classification: 'missing-content', ruleId: 'B1', category: 'B' },
  'integrity:team-history-structure': { classification: 'team-history-structure', ruleId: 'B1', category: 'B' },
  'integrity:filmroom-structure': { classification: 'filmroom-structure', ruleId: 'B1', category: 'B' },
  'integrity:feed-dedup': { classification: 'autoposter-duplication', ruleId: 'C1', category: 'C' },
  'integrity:autoposter-dedup': { classification: 'autoposter-duplication', ruleId: 'C1', category: 'C' },
  'integrity:rankings': { classification: 'recruiting-board-mismatch', ruleId: 'D1', category: 'D' },
  'integrity:roster-images': { classification: 'missing-image', ruleId: 'E1', category: 'E' },
  'integrity:depth-chart': { classification: 'depth-chart-mismatch', ruleId: 'E2', category: 'E' },
  'integrity:film-sources': { classification: 'broken-link', ruleId: 'F3', category: 'F' },
  'integrity:article-links': { classification: 'broken-link', ruleId: 'F3', category: 'F' },
  'integrity:live-freshness': { classification: 'cache-stale', ruleId: 'F2', category: 'F' },
  'mobile-behavior:feed-freshness': { classification: 'autoposter-stale', ruleId: 'C4', category: 'C' },
  'mobile-behavior:stale-html': { classification: 'mobile-desktop-divergence', ruleId: 'A4', category: 'A' },
  'mobile-behavior:team-tab-theme': { classification: 'team-identity-layering', ruleId: 'A2', category: 'A' },
  'mobile-behavior:navigation-back': { classification: 'ui-regression', ruleId: 'A4', category: 'A' },
  'ux:modal-zindex': { classification: 'panel-clipping', ruleId: 'A2', category: 'A' },
  'ux:scroll-containers': { classification: 'layout-overflow', ruleId: 'A1', category: 'A' },
  'ux:overflow-visible': { classification: 'layout-overflow', ruleId: 'A1', category: 'A' },
  'visual-integrity:component-variants': { classification: 'ui-regression', ruleId: 'A1', category: 'A' },
  'visual-integrity:film-room-theme': { classification: 'filmroom-structure', ruleId: 'B1', category: 'B' },
  'pages:react-film-room': { classification: 'filmroom-structure', ruleId: 'B1', category: 'B' },
  'pages:react-team': { classification: 'missing-content', ruleId: 'B1', category: 'B' },
  'pages:react-recruiting-hub': { classification: 'recruiting-board-mismatch', ruleId: 'D1', category: 'D' },
  'pages:react-live-feed': { classification: 'autoposter-stale', ruleId: 'B3', category: 'B' },
  'integrity:react-markers': { classification: 'missing-content', ruleId: 'B1', category: 'B' },
  'integrity:react-exports': { classification: 'missing-content', ruleId: 'B1', category: 'B' },
  'pages:film-room-hooks': { classification: 'retired-monolith', ruleId: null, category: 'Z' },
  'pages:team-hooks': { classification: 'retired-monolith', ruleId: null, category: 'Z' },
  'content:team-module': { classification: 'team-history-structure', ruleId: 'B1', category: 'B' },
  'api:ping': { classification: 'api-latency', ruleId: 'F1', category: 'F' },
  'api:live-dashboard': { classification: 'cache-stale', ruleId: 'F2', category: 'F' },
  'api:live-pipeline-health': { classification: 'cache-stale', ruleId: 'F2', category: 'F' },
  'api:recruiting-board': { classification: 'recruiting-board-mismatch', ruleId: 'D1', category: 'D' },
  'api:roster-players': { classification: 'roster-mismatch', ruleId: 'E1', category: 'E' },
  'api:war-room-breakdowns': { classification: 'recruiting-board-mismatch', ruleId: 'D2', category: 'D' },
  'api:film-room-catalog': { classification: 'filmroom-structure', ruleId: 'B1', category: 'B' },
  'crawler:overflow': { classification: 'layout-overflow', ruleId: 'A1', category: 'A' },
  'crawler:layering': { classification: 'panel-clipping', ruleId: 'A2', category: 'A' },
  'crawler:background': { classification: 'wrong-background', ruleId: 'A3', category: 'A' },
  'crawler:viewport-divergence': { classification: 'mobile-desktop-divergence', ruleId: 'A4', category: 'A' },
  'crawler:missing-content': { classification: 'missing-content', ruleId: 'B1', category: 'B' },
  'crawler:pressers-missing': { classification: 'pressers-missing', ruleId: 'B1', category: 'B' },
  'crawler:highlights-missing': { classification: 'highlights-missing', ruleId: 'B1', category: 'B' },
  'crawler:wrong-ordering': { classification: 'wrong-ordering', ruleId: 'B2', category: 'B' },
  'crawler:stale-content': { classification: 'autoposter-stale', ruleId: 'B3', category: 'B' },
  'crawler:autoposter-dup': { classification: 'autoposter-duplication', ruleId: 'C1', category: 'C' },
  'crawler:autoposter-similarity': { classification: 'autoposter-duplication', ruleId: 'C2', category: 'C' },
  'crawler:uf-only': { classification: 'missing-content', ruleId: 'C3', category: 'C' },
  'crawler:autoposter-stale': { classification: 'autoposter-stale', ruleId: 'C4', category: 'C' },
  'crawler:recruiting-mismatch': { classification: 'recruiting-board-mismatch', ruleId: 'D1', category: 'D' },
  'crawler:war-room': { classification: 'recruiting-board-mismatch', ruleId: 'D2', category: 'D' },
  'crawler:roster-mismatch': { classification: 'roster-mismatch', ruleId: 'E1', category: 'E' },
  'crawler:depth-chart': { classification: 'depth-chart-mismatch', ruleId: 'E2', category: 'E' },
  'crawler:api-latency': { classification: 'api-latency', ruleId: 'F1', category: 'F' },
  'crawler:cache-stale': { classification: 'cache-stale', ruleId: 'F2', category: 'F' },
  'crawler:404': { classification: '404-detected', ruleId: 'F3', category: 'F' }
};

function matchRuleByPattern(checkId, rulesDoc) {
  const id = String(checkId || '').toLowerCase();
  for (const rule of Object.values(rulesDoc.rules || {})) {
    const hit = (rule.checkPatterns || []).some((pat) => id.includes(pat.toLowerCase()));
    if (hit) {
      return {
        classification: rule.classification,
        ruleId: rule.id,
        category: rule.category,
        ruleName: rule.name,
        defaultImpact: rule.defaultImpact,
        defaultConfidence: rule.defaultConfidence
      };
    }
  }
  return null;
}

function classifySignal(signal) {
  const rulesDoc = loadRules();
  const checkId = signal.checkId || signal.id || '';
  const direct = CHECK_MAP[checkId];
  if (direct) {
    const rule = rulesDoc.rules[direct.ruleId] || {};
    return {
      ...direct,
      ruleName: rule.name || direct.ruleId,
      defaultImpact: rule.defaultImpact ?? 60,
      defaultConfidence: rule.defaultConfidence ?? 80,
      source: signal.source || signal.module || 'unknown'
    };
  }

  const matched = matchRuleByPattern(checkId, rulesDoc);
  if (matched) return { ...matched, source: signal.source || signal.module || 'unknown' };

  if (signal.classification && rulesDoc.classifications.includes(signal.classification)) {
    return {
      classification: signal.classification,
      ruleId: signal.ruleId || 'B1',
      category: signal.category || 'B',
      ruleName: signal.ruleName || signal.classification,
      defaultImpact: signal.impact ?? 50,
      defaultConfidence: signal.confidence ?? 70,
      source: signal.source || 'signal'
    };
  }

  return {
    classification: 'ui-regression',
    ruleId: 'A1',
    category: 'A',
    ruleName: 'Unclassified Issue',
    defaultImpact: 50,
    defaultConfidence: 60,
    source: signal.module || 'unknown'
  };
}

function classifyCheck(check) {
  return classifySignal({
    checkId: check.id,
    module: check.module,
    error: check.error,
    details: check.details
  });
}

module.exports = {
  loadRules,
  classifySignal,
  classifyCheck,
  CHECK_MAP
};
