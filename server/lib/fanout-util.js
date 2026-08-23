/**
 * Bounded concurrency helpers for member fan-out (push / email).
 * Keep defaults conservative — providers rate-limit harder than CPU.
 */
'use strict';

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapPool(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const results = new Array(list.length);
  let idx = 0;
  const workers = Math.min(Math.max(1, Number(limit) || 1), list.length);

  async function worker() {
    while (idx < list.length) {
      const i = idx;
      idx += 1;
      results[i] = await fn(list[i], i);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function envInt(name, fallback, { min = 1, max = 32 } = {}) {
  const n = Number.parseInt(String(process.env[name] ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pushFanoutConcurrency() {
  return envInt('PUSH_FANOUT_CONCURRENCY', 6, { min: 1, max: 16 });
}

function visitEmailFanoutConcurrency() {
  return envInt('VISIT_EMAIL_FANOUT_CONCURRENCY', 4, { min: 1, max: 12 });
}

function announceEmailConcurrency() {
  return envInt('ANNOUNCE_EMAIL_CONCURRENCY', 3, { min: 1, max: 8 });
}

function announceSaveEvery() {
  return envInt('ANNOUNCE_SAVE_EVERY', 1, { min: 1, max: 50 });
}

function onboardingMaxSendsPerTick() {
  return envInt('ONBOARDING_MAX_SENDS_PER_TICK', 40, { min: 1, max: 500 });
}

function onboardingSaveEvery() {
  return envInt('ONBOARDING_SAVE_EVERY', 5, { min: 1, max: 100 });
}

module.exports = {
  mapPool,
  envInt,
  pushFanoutConcurrency,
  visitEmailFanoutConcurrency,
  announceEmailConcurrency,
  announceSaveEvery,
  onboardingMaxSendsPerTick,
  onboardingSaveEvery,
};
