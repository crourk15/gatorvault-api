/**
 * Self-Runner — post-deploy validation (QA crawl + Product Intelligence recompute).
 */
const qaRunner = require('../qa/qa-runner');
const productEngine = require('../product-intel/product-intel-engine');
const scoring = require('../product-intel/product-intel-scoring');
const engine = require('./self-runner-engine');

async function validateFix(fix, opts = {}) {
  const checkId = fix.checkId;
  const crawl = await qaRunner.runQaCrawl({ force: true });
  if (!crawl.ok && crawl.skipped) {
    return { ok: false, phase: 'qa', error: crawl.reason || 'qa_skipped' };
  }

  const run = crawl.run;
  if (!run) {
    return { ok: false, phase: 'qa', error: 'no_qa_run' };
  }

  const check = engine.findCheckInRun(run, checkId);
  const issueResolved = check ? check.pass : !scoring.flattenChecks(run).some((c) => c.id === checkId && !c.pass);

  let intel = null;
  try {
    intel = productEngine.recomputeFromRun(run, { daily: true, weekly: false });
  } catch (err) {
    intel = { ok: false, error: err.message };
  }

  engine.generateProposalsFromProductIntel();

  return {
    ok: issueResolved,
    issueResolved,
    qaPass: run.pass,
    checkId,
    checkPass: check?.pass ?? null,
    overall: intel?.scores?.overall ?? null,
    moduleScore: intel?.scores?.modules?.[fix.module] ?? null,
    runId: run.id,
    validatedAt: new Date().toISOString()
  };
}

module.exports = { validateFix };
