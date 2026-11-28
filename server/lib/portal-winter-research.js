/**
 * Desk-only winter 2027 portal research.
 * Never merge named candidates into getPortalBoard() or fan incoming.
 * Fan FutureCast Portal Room reads sanitized prep from portal-fan-prep.js (rooms / thesis / window).
 */
const fs = require('fs');
const path = require('path');

const RESEARCH_PATH = path.join(__dirname, '../data/portal/winter-2027-research.json');

function loadWinter2027PortalResearch() {
  const raw = JSON.parse(fs.readFileSync(RESEARCH_PATH, 'utf8'));
  if (raw.fanShip === true) {
    throw new Error('winter 2027 portal research is desk-only — fanShip must stay false');
  }
  return raw;
}

/** Hard lock: this desk file must not become fan portal candidates. */
function fanPortalCandidatesFromResearch() {
  const research = loadWinter2027PortalResearch();
  if (research.fanShip !== false) return [];
  return [];
}

module.exports = {
  RESEARCH_PATH,
  loadWinter2027PortalResearch,
  fanPortalCandidatesFromResearch,
};
