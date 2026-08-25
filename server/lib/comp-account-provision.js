/**
 * Complimentary / media-comp accounts — create if missing, grant tier, email a
 * 24-hour password setup link that opens in the browser (not the iOS app).
 */
const crypto = require('crypto');
const { hashPassword } = require('./password-auth');
const { findUserByEmail, loadUsers, saveUsers, updateUser } = require('./user-store');
const { applySubscription, buildSubscriptionStatus } = require('./subscription-service');
const { normalizeTier } = require('./subscription-config');
const { requestPasswordReset } = require('./password-reset');

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function provisionComplimentaryAccount({
  email: emailRaw,
  name,
  tier: tierRaw = 'war',
  deliverEmail,
  sendSetupEmail = true,
} = {}) {
  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'A valid email is required.' };
  }

  const tier = normalizeTier(tierRaw || 'war');
  const displayName = String(name || '').trim() || email.split('@')[0];

  let user = findUserByEmail(email);
  let created = false;

  if (!user) {
    const users = loadUsers();
    const placeholder = crypto.randomBytes(24).toString('base64url') + 'A1!x';
    user = {
      email,
      name: displayName,
      tier: 'locker',
      passwordHash: hashPassword(placeholder),
      createdAt: new Date().toISOString(),
      complimentary: true,
      signupChannel: 'admin-comp',
    };
    users.push(user);
    saveUsers(users);
    created = true;
  } else if (displayName && displayName !== user.name) {
    user = updateUser(email, { name: displayName, complimentary: true }) || user;
  } else if (!user.complimentary) {
    user = updateUser(email, { complimentary: true }) || user;
  }

  applySubscription(email, {
    source: 'manual',
    status: 'active',
    productId: `manual.${tier}`,
    tier,
    originalTransactionId: null,
    expiresAt: null,
  });

  let emailSent = false;
  let emailError = null;
  if (sendSetupEmail) {
    if (typeof deliverEmail !== 'function') {
      return {
        ok: false,
        status: 503,
        error: 'Email deliverer not ready — cannot send the password setup link.',
        created,
        email,
      };
    }
    const sent = await requestPasswordReset(email, { deliverEmail, setup: true });
    emailSent = Boolean(sent?.emailSent);
    emailError = sent?.error || null;
  }

  const refreshed = findUserByEmail(email);
  return {
    ok: true,
    status: 200,
    created,
    email,
    name: refreshed?.name || displayName,
    tier,
    emailSent,
    emailError,
    setupEmailed: sendSetupEmail,
    statusPayload: refreshed ? buildSubscriptionStatus(refreshed) : null,
  };
}

module.exports = {
  provisionComplimentaryAccount,
};
