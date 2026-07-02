/**
 * Autoposter Phase 2 — aggregate discovery collectors.
 */
const { discoveryEnabled } = require('./discovery-core');
const ufOfficial = require('./discovery-uf-official');
const roster = require('./discovery-roster');
const scouting = require('./discovery-scouting');
const gameZone = require('./discovery-game-zone');

async function collectAllDiscoveryCandidates(opts = {}) {
  if (!discoveryEnabled()) return [];
  const widen = !!(opts.forcePost || opts.digDeeper);
  const merged = [];
  const ufLimit = parseInt(process.env.X_AUTOPOST_UF_OFFICIAL_LIMIT || (widen ? '12' : '8'), 10);
  const runs = [
    () => ufOfficial.collectUfOfficialNewsCandidates({ forcePost: widen, limit: ufLimit }),
    () => roster.collectRosterDeltaCandidates(),
    () => scouting.collectScoutingUpdateCandidates(),
    () => gameZone.collectGameZoneCandidates(),
  ];
  for (const run of runs) {
    try {
      for (const row of await run()) merged.push(row);
    } catch (err) {
      console.warn('[discovery]', err.message);
    }
  }
  return merged;
}

module.exports = {
  discoveryEnabled,
  collectAllDiscoveryCandidates,
  collectUfOfficialNewsCandidates: ufOfficial.collectUfOfficialNewsCandidates,
  collectRosterDeltaCandidates: roster.collectRosterDeltaCandidates,
  collectScoutingUpdateCandidates: scouting.collectScoutingUpdateCandidates,
  collectGameZoneCandidates: gameZone.collectGameZoneCandidates,
  scanRosterDeltas: roster.scanRosterDeltas,
  buildNewsFromRosterEvent: roster.buildNewsFromRosterEvent,
};

