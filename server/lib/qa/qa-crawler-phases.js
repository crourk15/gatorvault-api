/**
 * QA Crawler — 3-phase orchestrator
 * Phase 1 Fetch → Phase 2 Analyze → Phase 3 Emit
 */
const config = require('./qa-config');
const { runApiChecks } = require('./qa-api-checks');
const { runContentChecks } = require('./qa-content-checks');
const { runIntegrityChecks } = require('./qa-integrity-checks');
const { runSectionChecks } = require('./qa-section-checks');
const { runPageChecks } = require('./qa-page-checks');
const { runUxChecks } = require('./qa-ux-checks');
const { runBrowserChecks } = require('./qa-browser-checks');
const { runMobileBehaviorChecks } = require('./qa-mobile-behavior-checks');
const { runVisualIntegrityChecks } = require('../visual-integrity/visual-integrity-checks');
const { fetchPhase } = require('./qa-crawler-fetch');
const { analyzeSnapshots } = require('./qa-crawler-rules');
const { emitPhase, issuesToErrors } = require('./qa-crawler-emit');

async function runModuleChecks(opts = {}) {
  if (opts.apiOnly) {
    const api = await runApiChecks();
    return { api, modules: { api } };
  }

  const [api, content, integrityBase, pages, ux, browser, visualIntegrity, mobileBehavior, sectionIntegrity] =
    await Promise.all([
      runApiChecks(),
      runContentChecks(),
      runIntegrityChecks(),
      runPageChecks(),
      runUxChecks(),
      runBrowserChecks(),
      runVisualIntegrityChecks({ local: config.SCAN_LOCAL !== false }),
      runMobileBehaviorChecks(),
      runSectionChecks()
    ]);

  const integrity = {
    module: 'integrity',
    checks: [...(integrityBase.checks || []), ...(sectionIntegrity.checks || [])],
    pass: [...(integrityBase.checks || []), ...(sectionIntegrity.checks || [])].every((c) => c.pass),
    startedAt: integrityBase.startedAt,
    finishedAt: new Date().toISOString()
  };

  const modules = {
    api,
    content,
    integrity,
    pages,
    ux,
    browser,
    'visual-integrity': visualIntegrity,
    'mobile-behavior': mobileBehavior
  };

  return { modules };
}

/**
 * Full 3-phase crawl.
 */
async function runCrawlerPhases(opts = {}) {
  const phaseTimings = { fetch: 0, analyze: 0, emit: 0, modules: 0 };

  // Phase 1 — Fetch
  const tFetch = Date.now();
  const fetchResult = await fetchPhase({
    browser: !opts.apiOnly && config.BROWSER_ENABLED,
    viewports: opts.viewports || ['desktop', 'mobile']
  });
  phaseTimings.fetch = Date.now() - tFetch;

  // Phase 2a — Module checks (parallel with snapshot rules)
  const tModules = Date.now();
  const { modules: moduleResults } = await runModuleChecks(opts);
  phaseTimings.modules = Date.now() - tModules;

  // Phase 2b — Snapshot rule analysis
  const tAnalyze = Date.now();
  const crawlerAnalysis = opts.apiOnly ? { issues: [], checks: [], module: { module: 'crawler', checks: [], pass: true } } : await analyzeSnapshots(fetchResult);
  phaseTimings.analyze = Date.now() - tAnalyze;

  const modules = {
    ...moduleResults,
    crawler: crawlerAnalysis.module
  };

  // Phase 3 — Emit
  const tEmit = Date.now();
  const emission = emitPhase(modules, fetchResult);
  phaseTimings.emit = Date.now() - tEmit;

  const allChecks = Object.values(modules).flatMap((m) => m.checks || []);
  const failed = allChecks.filter((c) => !c.pass);
  const errors = issuesToErrors(emission.issues);

  const screenshot =
    emission.issues.find((i) => i.screenshotCrop)?.screenshotCrop ||
    moduleResults.browser?.checks?.find((c) => c.details?.screenshot)?.details?.screenshot ||
    null;

  return {
    fetch: fetchResult,
    analyze: {
      crawlerIssues: crawlerAnalysis.issues.length,
      ruleChecks: crawlerAnalysis.checks.length
    },
    emit: emission,
    modules,
    allChecks,
    failed,
    errors,
    issues: emission.issues,
    screenshot,
    phases: {
      fetch: { snapshotCount: fetchResult.meta.snapshotCount, playwright: fetchResult.meta.playwright },
      analyze: { failedChecks: failed.length, crawlerIssues: crawlerAnalysis.issues.length },
      emit: emission.meta,
      timingsMs: phaseTimings
    }
  };
}

module.exports = {
  runCrawlerPhases,
  runModuleChecks
};
