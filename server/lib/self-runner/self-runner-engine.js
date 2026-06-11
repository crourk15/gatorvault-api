/**
 * Self-Runner engine — reads product-intel fix queue, generates pending proposals.
 */
const productStore = require('../product-intel/product-intel-store');
const qaStore = require('../qa/qa-store');
const queue = require('./self-runner-queue');
const prepare = require('./self-runner-prepare');
const patches = require('./self-runner-patches');

function findCheckInRun(run, checkId) {
  if (!run?.modules) return null;
  for (const mod of Object.values(run.modules)) {
    const hit = (mod.checks || []).find((c) => c.id === checkId);
    if (hit) return hit;
  }
  return null;
}

function existingPendingForIssue(sourceIssueId) {
  return (queue.readDoc().items || []).find(
    (i) => i.sourceIssueId === sourceIssueId && ['pending', 'approved', 'applying'].includes(i.status)
  );
}

function generateProposalsFromProductIntel(opts = {}) {
  const piDoc = productStore.readDoc();
  const openFixes = (piDoc.fixQueue || []).filter((f) => !f.resolved);
  const qaDoc = qaStore.readDoc();
  const latestRun = (qaDoc.runs || [])[0] || null;

  const created = [];
  const skipped = [];
  let seq = (queue.readDoc().items || []).length + 1;

  openFixes.forEach((issue) => {
    if (!patches.isEligible(issue)) {
      skipped.push({ id: issue.id, reason: 'not_eligible' });
      return;
    }
    if (existingPendingForIssue(issue.id)) {
      skipped.push({ id: issue.id, reason: 'already_pending' });
      return;
    }

    const checkDetails = issue.checkId && latestRun ? findCheckInRun(latestRun, issue.checkId) : null;
    const proposal = prepare.prepareFixProposal(issue, { seq, checkDetails });
    if (!proposal) {
      skipped.push({ id: issue.id, reason: 'no_patch_template' });
      return;
    }

    queue.addPending(proposal);
    created.push(proposal);
    seq += 1;
  });

  if (created.length || opts.logEmpty === true) {
    let doc = queue.readDoc();
    doc = queue.appendLog(doc, {
      action: 'generate',
      created: created.length,
      skipped: skipped.length,
      runId: latestRun?.id || null
    });
    queue.writeDoc(doc);
  }

  return { created, skipped, pending: queue.listByStatus('pending').length };
}

function markIssueManualReview(sourceIssueId, reason) {
  const piDoc = productStore.readDoc();
  const items = (piDoc.fixQueue || []).map((f) => {
    if (f.id !== sourceIssueId) return f;
    return { ...f, manualReview: true, manualReviewReason: reason, updatedAt: new Date().toISOString() };
  });
  piDoc.fixQueue = items;
  productStore.writeDoc(piDoc);
}

function resolveSourceIssue(sourceIssueId) {
  const piDoc = productStore.readDoc();
  piDoc.fixQueue = (piDoc.fixQueue || []).map((f) => {
    if (f.id !== sourceIssueId) return f;
    return { ...f, resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: 'self-runner' };
  });
  productStore.writeDoc(piDoc);
}

function healthSummary() {
  const q = queue.summary();
  const pi = productStore.readDoc();
  const eligible = (pi.fixQueue || []).filter((f) => !f.resolved && patches.isEligible(f)).length;
  return {
    enabled: process.env.SELF_RUNNER_ENABLED !== 'false',
    queue: q,
    eligibleOpenIssues: eligible,
    productIntelOverall: pi.scores?.overall ?? null
  };
}

module.exports = {
  generateProposalsFromProductIntel,
  markIssueManualReview,
  resolveSourceIssue,
  findCheckInRun,
  healthSummary
};
