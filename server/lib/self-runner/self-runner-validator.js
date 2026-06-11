/**
 * Self-Runner — post-deploy validation (QA crawl + Product Intelligence recompute).
 */
const qaRunner = require('../qa/qa-runner');
const productEngine = require('../product-intel/product-intel-engine');
const scoring = require('../product-intel/product-intel-scoring');
const engine = require('./self-runner-engine');
const { runVisualIntegrityChecks } = require('../visual-integrity/visual-integrity-checks');

async function validateFix(fix, opts = {}) {
  const checkId = fix.checkId;
  let issueResolved = false;
  let localValidation = null;

  if (fix.module === 'visual-integrity' || String(checkId || '').startsWith('visual-integrity:')) {
    const localMod = await runVisualIntegrityChecks({ local: true });
    const hit = (localMod.checks || []).find((c) => c.id === checkId);
    issueResolved = hit ? hit.pass : localMod.pass;
    localValidation = {
      source: 'local:index.html',
      pass: issueResolved,
      checks: (localMod.checks || []).map((c) => ({ id: c.id, pass: c.pass, error: c.error || null }))
    };
  }

  const crawl = await qaRunner.runQaCrawl({ force: true });
  if (!crawl.ok && crawl.skipped) {
    return { ok: false, phase: 'qa', error: crawl.reason || 'qa_skipped', localValidation };
  }

  const run = crawl.run;
  if (!run) {
    return { ok: false, phase: 'qa', error: 'no_qa_run', localValidation };
  }

  const remoteCheck = engine.findCheckInRun(run, checkId);
  if (!issueResolved) {
    issueResolved = remoteCheck
      ? remoteCheck.pass
      : !scoring.flattenChecks(run).some((c) => c.id === checkId && !c.pass);
  }

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
    checkPass: remoteCheck?.pass ?? null,
    localValidation,
    overall: intel?.scores?.overall ?? null,
    moduleScore: intel?.scores?.modules?.[fix.module] ?? null,
    runId: run.id,
    validatedAt: new Date().toISOString(),
    note: localValidation?.pass && !remoteCheck?.pass
      ? 'Local patch validated; deploy index.html/css to Netlify for production QA to pass'
      : null
  };
}

module.exports = { validateFix };
