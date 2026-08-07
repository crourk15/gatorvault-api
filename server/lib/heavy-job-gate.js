/**
 * Heavy-job admission gate - QUEUE, never skip.
 *
 * Member-facing product work (On3, beat ingest, allowlist intel, hub warm,
 * Film Room sync) all still run. This only serializes them on the web dyno
 * so they do not collide and take /ready (and profiles) down.
 *
 * Nested calls from inside an already-gated job re-enter without waiting
 * (hub-refresh -> hub-warm must not deadlock).
 */
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

let tail = Promise.resolve();
let activeName = null;
let queued = 0;
let completed = 0;
let lastStartedAt = null;
let lastFinishedAt = null;
let lastError = null;

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Max concurrent heavy jobs. Default 1 on the web dyno. */
function concurrency() {
  return envInt('HEAVY_JOB_CONCURRENCY', 1);
}

// Simple semaphore for concurrency > 1 (still queues; never skips).
let inFlight = 0;
const waiters = [];

function acquireSlot() {
  if (inFlight < concurrency()) {
    inFlight += 1;
    return Promise.resolve();
  }
  queued += 1;
  return new Promise((resolve) => {
    waiters.push(() => {
      queued = Math.max(0, queued - 1);
      inFlight += 1;
      resolve();
    });
  });
}

function releaseSlot() {
  inFlight = Math.max(0, inFlight - 1);
  const next = waiters.shift();
  if (next) next();
}

/**
 * Run fn when a heavy-job slot is free. Always runs - never returns skipped.
 * @param {string} name
 * @param {() => Promise<any>|any} fn
 */
async function runHeavyJob(name, fn) {
  const label = String(name || 'heavy-job');
  if (als.getStore()?.active) {
    return fn();
  }

  // Concurrency 1 uses a promise chain (strict FIFO, clear logs).
  if (concurrency() <= 1) {
    const job = async () =>
      als.run({ active: true, name: label }, async () => {
        activeName = label;
        lastStartedAt = new Date().toISOString();
        const started = Date.now();
        console.log('[heavy-job-gate] start', label);
        try {
          const result = await fn();
          lastError = null;
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          throw err;
        } finally {
          completed += 1;
          lastFinishedAt = new Date().toISOString();
          console.log('[heavy-job-gate] done', label, `${Date.now() - started}ms`);
          activeName = null;
        }
      });

    const result = tail.then(job, job);
    tail = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  await acquireSlot();
  return als.run({ active: true, name: label }, async () => {
    activeName = label;
    lastStartedAt = new Date().toISOString();
    const started = Date.now();
    console.log('[heavy-job-gate] start', label);
    try {
      const result = await fn();
      lastError = null;
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      completed += 1;
      lastFinishedAt = new Date().toISOString();
      console.log('[heavy-job-gate] done', label, `${Date.now() - started}ms`);
      activeName = null;
      releaseSlot();
    }
  });
}

function getHeavyJobGateStatus() {
  return {
    activeName,
    queued,
    inFlight,
    concurrency: concurrency(),
    completed,
    lastStartedAt,
    lastFinishedAt,
    lastError,
  };
}

function isHeavyJobActive(name) {
  if (!name) return !!activeName;
  return activeName === String(name);
}

module.exports = {
  runHeavyJob,
  getHeavyJobGateStatus,
  isHeavyJobActive,
};
