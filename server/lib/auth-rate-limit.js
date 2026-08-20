/**
 * In-memory rate limits for auth endpoints (single dyno).
 * Protects scrypt CPU and credential stuffing as membership grows.
 */
'use strict';

const DEFAULTS = {
  login: { windowMs: 15 * 60 * 1000, maxPerKey: 12, maxPerIp: 40 },
  register: { windowMs: 60 * 60 * 1000, maxPerKey: 8, maxPerIp: 20 },
  forgot: { windowMs: 60 * 60 * 1000, maxPerKey: 6, maxPerIp: 15 },
};

/** @type {Map<string, number[]>} */
const buckets = new Map();

function prune(timestamps, now, windowMs) {
  return timestamps.filter((t) => now - t < windowMs);
}

function clientIp(req) {
  const xf = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (xf) return xf;
  return String(req?.ip || req?.socket?.remoteAddress || 'unknown');
}

/**
 * @param {'login'|'register'|'forgot'} kind
 * @param {{ email?: string, ip?: string, now?: number, limits?: object }} opts
 */
function checkAuthRateLimit(kind, opts = {}) {
  const cfg = { ...DEFAULTS[kind], ...(opts.limits || {}) };
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const ip = String(opts.ip || 'unknown').trim() || 'unknown';
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();

  const ipKey = `${kind}:ip:${ip}`;
  const emailKey = email ? `${kind}:email:${email}` : null;

  const ipHits = prune(buckets.get(ipKey) || [], now, cfg.windowMs);
  if (ipHits.length >= cfg.maxPerIp) {
    const retryAfterSec = Math.max(1, Math.ceil((cfg.windowMs - (now - ipHits[0])) / 1000));
    return { ok: false, code: 'rate_limited', retryAfterSec, scope: 'ip' };
  }

  if (emailKey) {
    const emailHits = prune(buckets.get(emailKey) || [], now, cfg.windowMs);
    if (emailHits.length >= cfg.maxPerKey) {
      const retryAfterSec = Math.max(1, Math.ceil((cfg.windowMs - (now - emailHits[0])) / 1000));
      return { ok: false, code: 'rate_limited', retryAfterSec, scope: 'email' };
    }
    emailHits.push(now);
    buckets.set(emailKey, emailHits);
  }

  ipHits.push(now);
  buckets.set(ipKey, ipHits);
  return { ok: true };
}

/** Test helper — clear all buckets. */
function resetAuthRateLimitForTests() {
  buckets.clear();
}

function rateLimitResponse(res, result) {
  const retry = Math.max(1, Number(result.retryAfterSec) || 60);
  res.setHeader('Retry-After', String(retry));
  return res.status(429).json({
    ok: false,
    code: 'rate_limited',
    error: 'Too many attempts. Please wait a few minutes and try again.',
    retryAfterSec: retry,
  });
}

module.exports = {
  checkAuthRateLimit,
  clientIp,
  rateLimitResponse,
  resetAuthRateLimitForTests,
  DEFAULTS,
};
