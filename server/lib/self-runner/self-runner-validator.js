/**
 * Self-Runner — post-deploy validation (QA crawl + Product Intelligence recompute).
 */
const qaRunner = require('../qa/qa-runner');
const productEngine = require('../product-intel/product-intel-engine');
const scoring = require('../product-intel/product-intel-scoring');
const engine = require('./self-runner-engine');
const { runVisualIntegrityChecks } = require('../visual-integrity/visual-integrity-checks');
const { buildFailureReport } = require('./self-runner-prepare');
const reactValidator = require('./validators/react-validator');
const failuresStore = require('./self-runner-failures/self-runner-failures-store');

async function validateFix(fix, opts = {}) {
  const checkId = fix.checkId;
  const retired = reactValidator.validateCheckId(checkId);
  if (retired.retired) {
    return {
      ok: false,
      phase: 'retired',
      error: 'retired_monolith_check',
      failureReport: {
        reason: `${checkId} is a retired monolith check`,
        expected: 'Use React pages:react-* or integrity:react-* checks',
        actual: retired.reason
      }
    };
  }

  let issueResolved = false;
  let localValidation = null;
  let localFailedCheck = null;

  if (fix.module === 'visual-integrity' || String(checkId || '').startsWith('visual-integrity:')) {
    const localMod = await runVisualIntegrityChecks({ local: true });
    localFailedCheck = (localMod.checks || []).find((c) => c.id === checkId);
    const hit = localFailedCheck || (localMod.checks || []).find((c) => c.id === checkId);
    issueResolved = hit ? hit.pass : localMod.pass;
    localValidation = {
      source: 'local:index.html',
      pass: issueResolved,
      checks: (localMod.checks || []).map((c) => ({ id: c.id, pass: c.pass, error: c.error || null, details: c.details || null }))
    };
    if (!localFailedCheck && !issueResolved) {
      localFailedCheck = (localMod.checks || []).find((c) => !c.pass);
    }
  }

  const crawl = await qaRunner.runQaCrawl({ force: true });
  if (!crawl.ok && crawl.skipped) {
    const failureReport = buildFailureReport({
      checkId,
      check: localFailedCheck,
      fix,
      localValidation,
      qaPass: false,
      appliedFiles: opts.appliedFiles
    });
    failuresStore.logFailure({
      runId: null,
      fixId: fix.id,
      checkId,
      reason: failureReport.reason,
      expected: failureReport.expected,
      actual: failureReport.actual || crawl.reason,
      correctivePatch: failureReport.correctivePatch,
      failureReport,
      phase: 'qa_skipped'
    });
    return { ok: false, phase: 'qa', error: crawl.reason || 'qa_skipped', localValidation, failureReport };
  }

  const run = crawl.run;
  if (!run) {
    const failureReport = buildFailureReport({
      checkId,
      check: localFailedCheck,
      fix,
      localValidation,
      qaPass: false,
      appliedFiles: opts.appliedFiles
    });
    failuresStore.logFailure({
      fixId: fix.id,
      checkId,
      reason: failureReport.reason,
      expected: failureReport.expected,
      actual: 'No QA run produced',
      correctivePatch: failureReport.correctivePatch,
      failureReport,
      phase: 'qa'
    });
    return { ok: false, phase: 'qa', error: 'no_qa_run', localValidation, failureReport };
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

  await engine.generateProposalsFromProductIntel();

  const qaPass = run.pass;
  const checkPass = remoteCheck?.pass ?? null;
  const targetFailed = !issueResolved;

  let failureReport = null;
  if (targetFailed || qaPass === false) {
    const primaryCheck =
      (!localFailedCheck?.pass ? localFailedCheck : null) ||
      (remoteCheck && !remoteCheck.pass ? remoteCheck : null) ||
      scoring.flattenChecks(run).find((c) => c.id === checkId && !c.pass) ||
      localFailedCheck;

    failureReport = buildFailureReport({
      checkId,
      check: primaryCheck,
      fix,
      run,
      localValidation,
      remoteCheck,
      qaPass,
      appliedFiles: opts.appliedFiles
    });

    failuresStore.logFailure({
      runId: run.id,
      fixId: fix.id,
      checkId,
      reason: failureReport.reason,
      expected: failureReport.expected,
      actual: failureReport.actual,
      correctivePatch: failureReport.correctivePatch,
      failureReport,
      phase: 'validate'
    });
  }

  return {
    ok: issueResolved,
    issueResolved,
    qaPass,
    checkId,
    checkPass,
    localValidation,
    failureReport,
    overall: intel?.scores?.overall ?? null,
    moduleScore: intel?.scores?.modules?.[fix.module] ?? null,
    runId: run.id,
    validatedAt: new Date().toISOString(),
    note:
      localValidation?.pass && remoteCheck && !remoteCheck.pass
        ? 'Local patch validated; deploy index.html/css to Netlify for production QA to pass'
        : failureReport?.correctivePatch?.suggestedFix || null
  };
}

module.exports = { validateFix };
