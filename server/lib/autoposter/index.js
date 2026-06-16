/**
 * GatorVault Autoposter Intelligence Engine
 *
 * intel → identity match → context enrichment → GM2 rewrite → quality checks → post
 */
const gm2Prompt = require('./gm2-rewrite-prompt');
const insiderTone = require('./insider-tone');
const identityMatcher = require('./identity-matcher');
const contextEnrichment = require('./context-enrichment');
const qualityChecks = require('./quality-checks');
const autoposterPolicy = require('./autoposter-policy');
const autoposterMonitoring = require('./autoposter-monitoring');

function loadRewriteEngine() {
  return require('./rewrite-engine');
}

function loadPostingEngine() {
  return require('./posting-engine');
}

module.exports = {
  gm2Prompt,
  insiderTone,
  identityMatcher,
  contextEnrichment,
  qualityChecks,
  autoposterPolicy,
  autoposterMonitoring,
  get rewriteEngine() {
    return loadRewriteEngine();
  },
  get postingEngine() {
    return loadPostingEngine();
  },
  GM2_REWRITE_PROMPT: gm2Prompt.GM2_REWRITE_PROMPT,
  matchIntelToPlayer: (...args) => identityMatcher.matchIntelToPlayer(...args),
  matchIdentity: (...args) => identityMatcher.matchIdentity(...args),
  enrichContext: (...args) => contextEnrichment.enrichContext(...args),
  enrichContextFull: (...args) => contextEnrichment.enrichContextFull(...args),
  validateRewrite: (...args) => qualityChecks.validateRewrite(...args),
  runQualityChecks: (...args) => qualityChecks.runQualityChecks(...args),
  isEligibleIntel: (...args) => autoposterPolicy.isEligibleIntel(...args),
  logAutoposterEvent: (...args) => autoposterMonitoring.logAutoposterEvent(...args),
  rewriteIntel: (...args) => loadRewriteEngine().rewriteIntel(...args),
  rewriteBeatUpdate: (...args) => loadRewriteEngine().rewriteBeatUpdate(...args),
  postToX: (...args) => loadPostingEngine().postToX(...args),
  assessEligibility: (...args) => loadPostingEngine().assessEligibility(...args),
  assessSkipReasons: (...args) => loadPostingEngine().assessSkipReasons(...args),
  getPolicyRules: (...args) => loadPostingEngine().getPolicyRules(...args),
  alertIfIdle: (...args) => autoposterMonitoring.alertIfIdle(...args),
  checkBeatFreshness: (...args) => autoposterMonitoring.checkBeatFreshness(...args),
  checkOn3Ingest: (...args) => autoposterMonitoring.checkOn3Ingest(...args),
  checkRewriteFailures: (...args) => autoposterMonitoring.checkRewriteFailures(...args),
  prepareQueueItemForPost: (...args) => require('./intelligence-pipeline').prepareQueueItemForPost(...args)
};
