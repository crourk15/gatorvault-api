const { hashPassword } = require('./password-auth');
const { findUserByEmail, loadUsers, saveUsers } = require('./user-store');
const { applySubscription, buildSubscriptionStatus } = require('./subscription-service');

const DEFAULT_REVIEW_EMAIL = 'appreview@gatorvaultinsider.com';

function allowedReviewEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const allowlist = String(process.env.APP_REVIEW_EMAIL || DEFAULT_REVIEW_EMAIL)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(normalized);
}

function provisionAppReviewAccount({ email, password, tier = 'war', name = 'App Store Review' }) {
  const normalized = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');

  if (!allowedReviewEmail(normalized)) {
    return { ok: false, status: 403, error: 'Email is not allowed for App Review provisioning.' };
  }
  if (!pwd || pwd.length < 12) {
    return { ok: false, status: 400, error: 'Password must be at least 12 characters.' };
  }

  const trialEnd = new Date();
  trialEnd.setFullYear(trialEnd.getFullYear() + 5);

  let user = findUserByEmail(normalized);
  let created = false;
  let passwordReset = false;

  if (!user) {
    const users = loadUsers();
    user = {
      email: normalized,
      name,
      tier: 'locker',
      passwordHash: hashPassword(pwd),
      createdAt: new Date().toISOString(),
      trialEnd: trialEnd.toISOString(),
    };
    users.push(user);
    saveUsers(users);
    created = true;
  } else {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.email === normalized);
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        passwordHash: hashPassword(pwd),
        trialEnd: trialEnd.toISOString(),
        name: users[idx].name || name,
      };
      saveUsers(users);
      passwordReset = true;
    }
  }

  const granted = applySubscription(normalized, {
    source: 'manual',
    status: 'active',
    productId: `manual.${tier}`,
    tier,
    originalTransactionId: null,
    expiresAt: trialEnd.toISOString(),
  });

  const refreshed = findUserByEmail(normalized) || granted;
  return {
    ok: true,
    status: 200,
    created,
    passwordReset,
    email: normalized,
    statusPayload: buildSubscriptionStatus(refreshed),
  };
}

/**
 * Idempotent boot hook — recreates the App Review demo account after ephemeral
 * disk wipes (Render restarts). Requires APP_REVIEW_PASSWORD in env.
 * Opt out with APP_REVIEW_BOOT_PROVISION=false.
 */
function ensureAppReviewAccountOnBoot() {
  const enabled = String(process.env.APP_REVIEW_BOOT_PROVISION || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    return { ok: false, skipped: true, reason: 'disabled' };
  }
  const password = String(process.env.APP_REVIEW_PASSWORD || '').trim();
  if (!password || password.length < 12) {
    return { ok: false, skipped: true, reason: 'missing_password' };
  }
  const email = String(process.env.APP_REVIEW_EMAIL || DEFAULT_REVIEW_EMAIL).trim().toLowerCase();
  const tier = String(process.env.APP_REVIEW_TIER || 'war').trim().toLowerCase() || 'war';
  try {
    const result = provisionAppReviewAccount({ email, password, tier });
    return {
      ok: result.ok,
      skipped: false,
      created: result.created,
      passwordReset: result.passwordReset,
      email: result.email,
      error: result.error || null,
    };
  } catch (err) {
    return { ok: false, skipped: false, error: String(err.message || err).slice(0, 200) };
  }
}

module.exports = {
  DEFAULT_REVIEW_EMAIL,
  allowedReviewEmail,
  provisionAppReviewAccount,
  ensureAppReviewAccountOnBoot,
};
