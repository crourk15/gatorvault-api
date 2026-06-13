/**
 * Integrity checks aggregator — React-native (Phase 8).
 */
const { moduleResult } = require('../../../qa/qa-utils');
const { runIntegrityChecks } = require('../../../qa/qa-integrity-checks');
const { runReactRouteValidationChecks } = require('./react-routes');
const { runFilmRoomStructureChecks } = require('./filmroom-structure');
const { runTeamStructureChecks } = require('./team-structure');
const { runLatestUpdatesChecks } = require('./latest-updates');
const { runRecruitingChecks } = require('./recruiting');
const config = require('../../../qa/qa-config');
const { check, fetchSiteBundleText } = require('../../../qa/qa-utils');

async function runSectionChecks() {
  const [baseMod, reactRoutes, film, team, live, recruiting] = await Promise.all([
    runIntegrityChecks(),
    runReactRouteValidationChecks(),
    runFilmRoomStructureChecks(),
    runTeamStructureChecks(),
    runLatestUpdatesChecks(),
    runRecruitingChecks()
  ]);

  const seen = new Set();
  const merged = [
    ...(baseMod.checks || []),
    ...reactRoutes.filter((c) => c.id?.startsWith('integrity:')),
    ...film.filter((c) => c.id?.startsWith('integrity:')),
    ...team.filter((c) => c.id?.startsWith('integrity:')),
    ...live.filter((c) => c.id?.startsWith('integrity:')),
    ...recruiting.filter((c) => c.id?.startsWith('integrity:'))
  ].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  if (config.SCAN_PRODUCTION !== false) {
    const prod = await check('integrity:production-vault-shell', 'integrity', 'Production vault uses React shell', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault');
      if (text.includes('vpane-start') || text.includes('gvOpenTeamDetail')) {
        const err = new Error('Production /vault still serves monolith hooks');
        err.repro = 'Publish React vault/index.html — not legacy-index.html';
        throw err;
      }
      if (!text.includes('gv-vault-shell') && !text.includes('vault-dashboard')) {
        throw new Error('Production /vault missing React VaultShell markers');
      }
      return { reactShell: true };
    });
    if (!seen.has(prod.id)) merged.push(prod);
  }

  return moduleResult('integrity', merged);
}

/** @deprecated use runReactRouteValidationChecks — kept for qa-routes compat */
const runMissingContentChecks = runReactRouteValidationChecks;

module.exports = {
  runSectionChecks,
  runMissingContentChecks,
  runReactRouteValidationChecks,
  runFilmRoomStructureChecks,
  runTeamStructureChecks,
  runLatestUpdatesChecks,
  runRecruitingChecks
};
