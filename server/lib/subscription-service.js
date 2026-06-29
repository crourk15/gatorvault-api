const { effectiveTier, isAdminAccount } = require('./session-auth');
const { normalizeTier, tierFromProductId } = require('./subscription-config');
const { findUserByEmail, updateUser } = require('./user-store');

function isSubscriptionActive(user) {
  if (!user?.subscription) return false;
  const status = String(user.subscription.status || '').toLowerCase();
  if (status === 'active' || status === 'grace') return true;
  if (user.subscription.expiresAt) {
    return new Date(user.subscription.expiresAt).getTime() > Date.now();
  }
  return false;
}

function hasPaidAccess(user) {
  if (!user) return false;
  if (isAdminAccount(user.email)) return true;
  if (user.paid) return true;
  return isSubscriptionActive(user);
}

function trialState(user) {
  const trialEndDate = user?.trialEnd ? new Date(user.trialEnd) : null;
  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const expired = trialEndDate ? trialEndDate.getTime() <= Date.now() : false;
  return {
    trialEndISO: user?.trialEnd || null,
    trialEndFormatted: trialEndDate
      ? trialEndDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null,
    daysLeft,
    expired,
  };
}

function buildSubscriptionStatus(user) {
  const trial = trialState(user);
  const paid = hasPaidAccess(user);
  const accessActive = paid || !trial.expired;
  const subscription = user?.subscription
    ? {
        source: user.subscription.source || null,
        status: user.subscription.status || null,
        productId: user.subscription.productId || null,
        tier: user.subscription.tier || null,
        expiresAt: user.subscription.expiresAt || null,
        updatedAt: user.subscription.updatedAt || null,
      }
    : null;

  return {
    ok: true,
    email: user?.email || null,
    tier: effectiveTier(user || {}),
    paid,
    accessActive,
    trial,
    subscription,
    billing: {
      appleIapEnabled: process.env.APPLE_IAP_VERIFICATION_ENABLED === 'true',
      webCheckoutEnabled: false,
      manageInAppHint: 'Subscriptions purchased in the iOS app are managed in Settings → Apple ID → Subscriptions.',
      manageWebHint:
        'For billing questions, tier changes, or cancellation help before iOS billing is live, email support.',
      supportEmail: 'support@gatorvaultinsider.com',
      accountDeletionPath: '/vault/membership/#delete-account',
    },
  };
}

function buildSessionFields(user, pointsStore) {
  const trial = trialState(user);
  const pts = pointsStore.getUserPoints(user.email);
  return {
    email: user.email,
    tier: effectiveTier(user),
    name: user.name,
    trialEnd: trial.trialEndFormatted,
    trialEndISO: trial.trialEndISO,
    createdAt: user.createdAt || null,
    daysLeft: trial.daysLeft,
    paid: hasPaidAccess(user),
    accessActive: hasPaidAccess(user) || !trial.expired,
    points: pts.points,
    pointsTier: pts.tier,
    subscription: user.subscription
      ? {
          source: user.subscription.source,
          status: user.subscription.status,
          productId: user.subscription.productId,
        }
      : null,
  };
}

function applySubscription(email, payload) {
  const tier = normalizeTier(payload.tier || tierFromProductId(payload.productId) || 'film');
  const now = new Date().toISOString();
  const subscription = {
    source: payload.source || 'apple',
    status: payload.status || 'active',
    productId: payload.productId || null,
    tier,
    originalTransactionId: payload.originalTransactionId || null,
    appAccountToken: payload.appAccountToken || null,
    expiresAt: payload.expiresAt || null,
    updatedAt: now,
  };
  const user = updateUser(email, {
    paid: true,
    tier,
    subscription,
  });
  return user;
}

function revokeSubscription(email, { status = 'expired', productId = null } = {}) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const now = new Date().toISOString();
  const subscription = {
    ...(user.subscription || {}),
    source: 'apple',
    status,
    productId: productId || user.subscription?.productId || null,
    tier: user.subscription?.tier || 'locker',
    updatedAt: now,
    expiresAt: user.subscription?.expiresAt || now,
  };
  return updateUser(email, {
    paid: false,
    tier: 'locker',
    subscription,
  });
}

function appleVerificationConfigured() {
  const { isAppleIapReady, readAppleIapConfig } = require('./apple-iap-verify');
  return isAppleIapReady(readAppleIapConfig());
}

async function verifyAppleTransaction(transactionId) {
  const { verifyStoreKitTransaction } = require('./apple-iap-verify');
  const verified = await verifyStoreKitTransaction(transactionId);
  const expiresAt =
    verified.expiresDate != null
      ? new Date(Number(verified.expiresDate)).toISOString()
      : null;
  return {
    ...verified,
    expiresAt,
  };
}

module.exports = {
  isSubscriptionActive,
  hasPaidAccess,
  trialState,
  buildSubscriptionStatus,
  buildSessionFields,
  applySubscription,
  revokeSubscription,
  appleVerificationConfigured,
  verifyAppleTransaction,
};
