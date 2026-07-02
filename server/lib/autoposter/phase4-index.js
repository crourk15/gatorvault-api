/** Phase 4 barrel — rhythm scheduling + ops intel snapshot. */
const timeBucket = require('./time-bucket');
function phase4Enabled() { return process.env.X_AUTOPOST_PHASE4_ENABLED !== 'false'; }
function getOperationalIntel() {
  const snap = { phase4Enabled: phase4Enabled(), timeBucket: timeBucket.getTimeBucket(), timeBucketsEnabled: timeBucket.timeBucketEnabled(), heatDiscovery: process.env.X_AUTOPOST_HEAT_DISCOVERY !== 'false' };
  try {
    const p3 = require('./phase3-index');
    snap.phase3Enabled = p3.phase3Enabled();
    snap.storyMemory = p3.storyMemory.getStoryMemorySummary();
    snap.topicMemory = p3.topicMemory.getTopicMemorySummary();
    snap.performance = p3.performanceTracker.getPerformanceSummary();
  } catch { snap.phase3Enabled = false; }
  try { snap.phase5 = require('./phase5-index').getPhase5Intel(); } catch { snap.phase5 = { phase5Enabled: false }; }
  return snap;
}
module.exports = { phase4Enabled, timeBucket, getOperationalIntel };
