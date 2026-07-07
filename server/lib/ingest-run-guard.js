/** Prevent overlapping ingest runs (On3 fetch aborts with TypeError: terminated). */
const locks = new Map();

function isIngestRunning(name) {
  return !!locks.get(name);
}

async function withIngestLock(name, fn) {
  if (locks.get(name)) {
    return { ok: true, skipped: true, reason: 'already_running', lock: name };
  }
  locks.set(name, true);
  try {
    return await fn();
  } finally {
    locks.set(name, false);
  }
}

module.exports = {
  isIngestRunning,
  withIngestLock
};
