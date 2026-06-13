/**
 * GatorVault Crawler — React-native orchestrator (Phase 8).
 * Maps blueprint folders to server/lib/crawler/checks/* modules.
 */
const { runPageChecks } = require('./checks/pages');
const { runSectionChecks } = require('./checks/integrity');
const { runUxChecks } = require('./checks/ux');
const { runVisualIntegrityChecks } = require('./checks/visual-integrity');
const { analyze404Assets } = require('./checks/crawler-404');
const { loadCrawlerConfig } = require('./load-config');

module.exports = {
  loadCrawlerConfig,
  runPageChecks,
  runSectionChecks,
  runUxChecks,
  runVisualIntegrityChecks,
  analyze404Assets
};
