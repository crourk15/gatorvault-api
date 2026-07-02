/** Phase 5 barrel — history discovery, engagement loop, expanded ladder. */
const historyLibrary = require('./discovery-history');
const engagementTracker = require('./engagement-tracker');
function phase5Enabled() { return process.env.X_AUTOPOST_PHASE5_ENABLED !== 'false'; }
function getPhase5Intel() {
  return { phase5Enabled: phase5Enabled(), historyDiscovery: historyLibrary.historyDiscoveryEnabled(), engagement: engagementTracker.getEngagementSummary() };
}
module.exports = { phase5Enabled, historyLibrary, engagementTracker, getPhase5Intel };
