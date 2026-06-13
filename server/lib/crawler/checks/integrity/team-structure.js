/**
 * integrity:team-structure — React Team / roster / depth chart (no monolith hooks).
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../qa/qa-config');
const { check, fetchSiteBundleText } = require('../../../qa/qa-utils');
const { isRetiredPattern } = require('../../load-config');

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', '..');

function readLocal(rel) {
  try {
    return fs.readFileSync(path.join(SERVER_ROOT, rel.replace(/^\//, '')), 'utf8');
  } catch {
    return '';
  }
}

async function runTeamStructureChecks() {
  const checks = [];

  checks.push(
    await check('integrity:roster-data', 'integrity', 'Roster API data file', async () => {
      let roster = null;
      try {
        roster = JSON.parse(readLocal('data/roster/players.json'));
      } catch {
        roster = null;
      }
      const players = roster?.players || roster?.items || roster;
      if (!Array.isArray(players) || players.length === 0) {
        const err = new Error('Roster data empty or missing');
        err.repro = 'Verify server/data/roster/players.json for VaultTeamPage';
        throw err;
      }
      return { players: players.length };
    })
  );

  checks.push(
    await check('integrity:depth-chart-data', 'integrity', 'Depth chart React data module', async () => {
      const depthPath = path.join(SERVER_ROOT, '..', 'client', 'lib', 'depth-chart-data.ts');
      let depthSrc = '';
      try {
        depthSrc = fs.readFileSync(depthPath, 'utf8');
      } catch {
        depthSrc = readLocal('data/roster/depth-chart.json');
      }
      if (!depthSrc || (!depthSrc.includes('DEPTH_BY_PHASE') && !depthSrc.includes('QB'))) {
        const err = new Error('Depth chart data module missing or empty');
        err.repro = 'Verify client/lib/depth-chart-data.ts exports DEPTH_BY_PHASE';
        throw err;
      }
      return { ok: true };
    })
  );

  checks.push(
    await check('pages:react-team', 'pages', 'React Team / depth chart', async () => {
      const text = await fetchSiteBundleText(config.SITE_URL, '/vault/team');
      if (isRetiredPattern(text)) {
        const err = new Error('Team page contains retired monolith hooks');
        err.repro = 'Deploy React VaultTeamPage — remove vpane/gvOpenTeamDetail';
        throw err;
      }
      const required = ['data-testid="vault-team"', 'gv-team-page', 'Depth Chart', 'Full Roster'];
      const missing = required.filter((k) => !text.includes(k));
      if (missing.length) {
        const err = new Error(`React Team markers missing: ${missing.join(', ')}`);
        err.url = `${config.SITE_URL}/vault/team`;
        throw err;
      }
      return { ok: true };
    })
  );

  return checks;
}

module.exports = { runTeamStructureChecks };
