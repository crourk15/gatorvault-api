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
  const log = {
    at: new Date().toISOString(),
    runId: latestRun?.id || null,
    openFixQueue: openFixes.length,
    eligibleOpenIssues: openFixes.filter((f) => patches.isEligible(f)).length,
    decisions: []
  };
  let seq = (queue.readDoc().items || []).length + 1;

  if (!latestRun) {
    log.summary = 'no_qa_run — run QA crawl first';
    console.warn('[self-runner] generate: no QA runs in store — POST /api/qa/run first');
  } else {
    log.summary = `qa_run_${latestRun.id} — ${latestRun.summary?.failed || 0} failed / ${latestRun.summary?.total || 0} total checks`;
  }

  if (!openFixes.length) {
    log.summary = (log.summary || '') + ' | fix_queue_empty';
    console.warn('[self-runner] generate: fix queue empty — no open Product Intel issues');
  }

  openFixes.forEach((issue) => {
    const classification = patches.classifyIneligibility(issue);

    if (!classification.eligible) {
      const entry = {
        id: issue.id,
        checkId: issue.checkId,
        reason: classification.reason,
        detail: classification.detail,
        severity: issue.severity
      };
      skipped.push(entry);
      log.decisions.push({ action: 'skipped', ...entry });
      console.log(
        `[self-runner] skip ${issue.id}: ${classification.reason}` +
          (classification.detail ? ` (${classification.detail})` : '')
      );
      return;
    }

    if (existingPendingForIssue(issue.id)) {
      const entry = { id: issue.id, checkId: issue.checkId, reason: 'already_pending' };
      skipped.push(entry);
      log.decisions.push({ action: 'skipped', ...entry });
      console.log(`[self-runner] skip ${issue.id}: already_pending`);
      return;
    }

    const checkDetails = issue.checkId && latestRun ? findCheckInRun(latestRun, issue.checkId) : null;
    const proposal = prepare.prepareFixProposal(issue, { seq, checkDetails });

    if (!proposal) {
      const entry = {
        id: issue.id,
        checkId: issue.checkId,
        reason: 'no_patch_template',
        patchType: classification.patchType
      };
      skipped.push(entry);
      log.decisions.push({ action: 'skipped', ...entry });
      console.log(
        `[self-runner] skip ${issue.id}: no_patch_template (patchType=${classification.patchType})`
      );
      return;
    }

    queue.addPending(proposal);
    created.push(proposal);
    log.decisions.push({
      action: 'created',
      id: proposal.id,
      sourceIssueId: issue.id,
      checkId: issue.checkId,
      patchType: proposal.patchType,
      severity: issue.severity
    });
    console.log(
      `[self-runner] created ${proposal.id} ← ${issue.id} [${proposal.patchType}]`
    );
    seq += 1;
  });

  let doc = queue.readDoc();
  doc = queue.appendLog(doc, {
    action: 'generate',
    created: created.length,
    skipped: skipped.length,
    runId: latestRun?.id || null,
    log
  });
  queue.writeDoc(doc);

  const result = {
    created,
    skipped,
    pending: queue.listByStatus('pending').length,
    log,
    qaRunId: latestRun?.id || null,
    fixQueueOpen: openFixes.length
  };

  console.log(
    `[self-runner] generate complete: ${created.length} created, ${skipped.length} skipped, ${result.pending} pending total`
  );

  return result;
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
  const openFixes = (pi.fixQueue || []).filter((f) => !f.resolved);
  const eligible = openFixes.filter((f) => patches.isEligible(f)).length;
  const ineligible = openFixes.filter((f) => !patches.isEligible(f));
  const qaDoc = qaStore.readDoc();
  const latestRun = (qaDoc.runs || [])[0] || null;

  return {
    enabled: process.env.SELF_RUNNER_ENABLED !== 'false',
    queue: q,
    eligibleOpenIssues: eligible,
    ineligibleOpenIssues: ineligible.length,
    ineligibleSample: ineligible.slice(0, 5).map((f) => ({
      id: f.id,
      checkId: f.checkId,
      ...patches.classifyIneligibility(f)
    })),
    fixQueueOpen: openFixes.length,
    productIntelOverall: pi.scores?.overall ?? null,
    lastQaRunId: latestRun?.id || null,
    lastQaFailed: latestRun?.summary?.failed ?? null
  };
}

module.exports = {
  generateProposalsFromProductIntel,
  markIssueManualReview,
  resolveSourceIssue,
  findCheckInRun,
  healthSummary
};
