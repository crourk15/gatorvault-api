/**
 * Prevent overlapping ingest runs from stomping each other.
 * Overlap now QUEUES via heavy-job-gate (never skips product work).
 */
const { runHeavyJob, isHeavyJobActive } = require('./heavy-job-gate');

function isIngestRunning(name) {
  return isHeavyJobActive(name);
}

async function withIngestLock(name, fn) {
  return runHeavyJob(name || 'ingest', fn);
}

module.exports = {
  isIngestRunning,
  withIngestLock,
};
