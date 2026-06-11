/**
 * QA Crawler — Phase 3: Emit
 * Standardized issue format for Product Intelligence + Self-Runner.
 */
const classifier = require('../product-intel/product-intel-classifier');
const severity = require('../product-intel/product-intel-severity');
const { RULE_CATALOG } = require('./qa-coverage-map');

/**
 * Blueprint issue emission format:
 * { id, category, severity, confidence, page, selector, domPath, screenshotCrop, recommendedFix }
 */
function emitIssueFromCheck(check, snapshot) {
  const details = check.details || {};
  const signal = {
    id: check.id,
    checkId: check.id,
    module: check.module,
    error: check.error || check.label,
    label: check.label,
    url: check.url,
    repro: check.repro,
    details,
    classification: details.classification || null,
    ruleId: details.ruleId || null
  };

  const classified = classifier.classifySignal(signal);
  const scored = severity.scoreIssue(
    { ...signal, classification: classified.classification, ruleId: classified.ruleId },
    null,
    1
  );

  const rule = RULE_CATALOG[classified.ruleId] || {};

  return {
    id: check.id,
    category: classified.category || details.category || rule.classification?.charAt(0) || 'F',
    classification: classified.classification || rule.classification || 'ui-regression',
    ruleId: classified.ruleId || details.ruleId || null,
    ruleName: classified.ruleName || null,
    severity: details.severity || scored.severity || 'medium',
    severityScore: scored.severityScore ?? null,
    confidence: details.confidence ?? classified.defaultConfidence ?? scored.components?.confidence ?? 80,
    page: snapshot?.page || (check.url ? new URL(check.url, 'https://x').pathname : '/'),
    selector: details.selector || details.domPath || null,
    domPath: details.domPath || details.selector || null,
    screenshotCrop: details.screenshot || snapshot?.screenshot || check.screenshot || null,
    recommendedFix: check.repro || check.error || check.label,
    module: check.module,
    sectionId: details.sectionId || snapshot?.sectionId || null,
    details: details.sectionId ? { sectionId: details.sectionId, ...details } : details,
    emittedAt: new Date().toISOString()
  };
}

function emitIssueFromRaw(rawIssue) {
  const check = {
    id: rawIssue.checkId,
    module: 'crawler',
    label: rawIssue.message,
    error: rawIssue.message,
    repro: rawIssue.recommendedFix,
    url: rawIssue.page ? rawIssue.page : null,
    details: {
      ruleId: rawIssue.ruleId,
      sectionId: rawIssue.sectionId,
      selector: rawIssue.selector,
      domPath: rawIssue.domPath,
      screenshot: rawIssue.screenshotCrop,
      severity: rawIssue.severity,
      confidence: rawIssue.confidence
    }
  };
  return emitIssueFromCheck(check, { page: rawIssue.page, sectionId: rawIssue.sectionId, screenshot: rawIssue.screenshotCrop });
}

function findSnapshotForCheck(check, snapshots) {
  const sectionId = check.details?.sectionId;
  if (!sectionId) return snapshots.find((s) => s.hydrated && s.viewport === 'desktop') || null;
  return (
    snapshots.find((s) => s.sectionId === sectionId && s.viewport === 'desktop' && s.hydrated) ||
    snapshots.find((s) => s.sectionId === sectionId) ||
    null
  );
}

/**
 * Phase 3 entry — convert all failed checks + raw crawler issues to emission format.
 */
function emitPhase(modules, fetchResult, rawCrawlerIssues = []) {
  const snapshots = fetchResult?.snapshots || [];
  const emitted = [];
  const seen = new Set();

  Object.values(modules || {}).forEach((mod) => {
    (mod.checks || []).forEach((check) => {
      if (check.pass) return;
      const snap = findSnapshotForCheck(check, snapshots);
      const issue = emitIssueFromCheck(check, snap);
      if (seen.has(issue.id)) return;
      seen.add(issue.id);
      emitted.push(issue);
    });
  });

  rawCrawlerIssues.forEach((raw) => {
    if (seen.has(raw.checkId)) return;
    const issue = emitIssueFromRaw(raw);
    const key = issue.id;
    if (seen.has(key)) return;
    seen.add(key);
    emitted.push(issue);
  });

  emitted.sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));

  const byCategory = emitted.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  return {
    issues: emitted,
    meta: {
      total: emitted.length,
      byCategory,
      bySeverity: emitted.reduce((acc, i) => {
        acc[i.severity] = (acc[i.severity] || 0) + 1;
        return acc;
      }, {}),
      emittedAt: new Date().toISOString()
    }
  };
}

/** Legacy flatten for qa-store compatibility */
function issuesToErrors(issues) {
  return issues.map((i) => ({
    id: i.id,
    module: i.module,
    message: i.recommendedFix || i.classification,
    url: i.page,
    repro: i.recommendedFix,
    details: {
      classification: i.classification,
      ruleId: i.ruleId,
      severity: i.severity,
      severityScore: i.severityScore,
      confidence: i.confidence,
      selector: i.selector,
      domPath: i.domPath,
      screenshot: i.screenshotCrop,
      sectionId: i.sectionId
    },
    screenshot: i.screenshotCrop
  }));
}

module.exports = {
  emitPhase,
  emitIssueFromCheck,
  emitIssueFromRaw,
  issuesToErrors
};
