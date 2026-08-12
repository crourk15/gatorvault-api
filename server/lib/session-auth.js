const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const check = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  // Constant-time compare when lengths match.
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(check);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getSessionFromReq(req) {
  const auth = req.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token && req.body && req.body.token) token = req.body.token;
  if (!token && req.query && req.query.token) token = req.query.token;
  return verifySession(token);
}

const TIER_LEVELS = { locker: 0, film: 1, war: 2 };

/**
 * Privileged operator emails — never grant via open self-register.
 * Prefer ADMIN_EMAIL_ALLOWLIST (comma-separated). Domain wildcards are opt-in only.
 */
function isAdminAccount(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;

  const allow = String(process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length) {
    return allow.includes(e);
  }

  // Legacy fallback for existing operator accounts (register still blocked below).
  return (
    e.endsWith('@gatorvaultinsider.com') ||
    e === 'gatorvaultinsider@gmail.com' ||
    e.includes('crourk')
  );
}

/** True when this email must not self-register (operator / spoof surface). */
function isReservedOperatorEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  if (isAdminAccount(e)) return true;
  return (
    e.endsWith('@gatorvaultinsider.com') ||
    e === 'gatorvaultinsider@gmail.com' ||
    e.includes('crourk')
  );
}

function effectiveTier(sessionOrUser) {
  if (!sessionOrUser) return null;
  if (isAdminAccount(sessionOrUser.email)) return 'war';
  return sessionOrUser.tier;
}

function tierLevel(tier) {
  const t = String(tier || '').toLowerCase();
  if (t === 'war' || t === 'elite') return TIER_LEVELS.war;
  if (t === 'film') return TIER_LEVELS.film;
  return TIER_LEVELS.locker;
}

/**
 * Active unpaid trial unlocks Film (not War) so trial members see Film soft gates.
 */
function trialFilmTierBoost(user, trial, paid) {
  if (paid) return null;
  if (!user?.trialEnd || trial?.expired) return null;
  return 'film';
}

/**
 * Gate paid APIs on live user entitlement — not stale JWT tier.
 * Deleted users and expired trials fail closed.
 * Active trial ⇒ Film access (War still requires paid War).
 */
function sessionHasTier(session, minTier) {
  if (!session?.email) return false;
  try {
    const { findUserByEmail } = require('./user-store');
    const { hasPaidAccess, trialState } = require('./subscription-service');
    const user = findUserByEmail(session.email);
    if (!user) return false;
    if (isAdminAccount(user.email)) {
      return tierLevel('war') >= tierLevel(minTier);
    }
    const trial = trialState(user);
    const paid = hasPaidAccess(user);
    const accessActive = paid || !trial.expired;
    if (!accessActive) return false;
    let tier = effectiveTier(user);
    const boost = trialFilmTierBoost(user, trial, paid);
    if (boost && tierLevel(boost) > tierLevel(tier)) {
      tier = boost;
    }
    return tierLevel(tier) >= tierLevel(minTier);
  } catch {
    // Fail closed if stores unavailable.
    return false;
  }
}

module.exports = {
  verifySession,
  getSessionFromReq,
  tierLevel,
  sessionHasTier,
  trialFilmTierBoost,
  isAdminAccount,
  isReservedOperatorEmail,
  effectiveTier,
  TIER_LEVELS,
};
