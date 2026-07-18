const { effectiveTier, isAdminAccount } = require('./session-auth');
const { normalizeTier, tierFromProductId } = require('./subscription-config');
const { findUserByEmail, updateUser } = require('./user-store');

const ENTITLED_STATUSES = new Set(['active', 'grace', 'canceled']);

function expiresAtMs(user) {
  const raw = user?.subscription?.expiresAt;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** True when subscription period is still open (or no expiry on a live status). */
function subscriptionPeriodOpen(user) {
  const exp = expiresAtMs(user);
  if (exp != null) return exp > Date.now();
  const status = String(user?.subscription?.status || '').toLowerCase();
  // Manual grants / legacy rows without expiresAt stay open while status is entitled.
  return ENTITLED_STATUSES.has(status);
}

function isSubscriptionActive(user) {
  if (!user?.subscription) return false;
  const status = String(user.subscription.status || '').toLowerCase();
  // Canceled keep access until Apple period end — matches App Store legalese.
  if (!ENTITLED_STATUSES.has(status)) return false;
  return subscriptionPeriodOpen(user);
}

function hasPaidAccess(user) {
  if (!user) return false;
  if (isAdminAccount(user.email)) return true;
  // Prefer time-bounded subscription state over a stale paid boolean.
  if (isSubscriptionActive(user)) return true;
  // Legacy paid accounts with no subscription record (pre-IAP grants).
  if (user.paid === true && !user.subscription) return true;
  return false;
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
        autoRenewEnabled: user.subscription.autoRenewEnabled,
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
      appStoreUrl: `https://apps.apple.com/app/id${String(process.env.APPLE_APP_APPLE_ID || '6783848215').trim()}`,
      manageInAppHint:
        'Subscriptions purchased in the iOS app are managed in Settings → Apple ID → Subscriptions.',
      manageWebHint:
        'Paid membership continues in the GatorVault iOS app. Open the App Store listing, sign in with this same email, then Subscribe or Restore — web Vault unlocks automatically.',
      supportEmail: 'support@gatorvaultinsider.com',
      accountDeletionPath: '/vault/membership/#delete-account',
    },
  };
}

function buildSessionFields(user, pointsStore) {
  const trial = trialState(user);
  const pts = pointsStore.getUserPoints(user.email);
  const paid = hasPaidAccess(user);
  const accessActive = paid || !trial.expired;
  return {
    email: user.email,
    tier: effectiveTier(user),
    name: user.name,
    trialEnd: trial.trialEndFormatted,
    trialEndISO: trial.trialEndISO,
    createdAt: user.createdAt || null,
    daysLeft: trial.daysLeft,
    paid,
    accessActive,
    membershipRequired: !accessActive,
    points: pts.points,
    pointsTier: pts.tier,
    subscription: user.subscription
      ? {
          source: user.subscription.source,
          status: user.subscription.status,
          productId: user.subscription.productId,
          expiresAt: user.subscription.expiresAt || null,
        }
      : null,
  };
}

function applySubscription(email, payload) {
  const tier = normalizeTier(payload.tier || tierFromProductId(payload.productId) || 'film');
  const now = new Date().toISOString();
  const status = String(payload.status || 'active').toLowerCase();
  const subscription = {
    source: payload.source || 'apple',
    status,
    productId: payload.productId || null,
    tier,
    originalTransactionId: payload.originalTransactionId || null,
    appAccountToken: payload.appAccountToken || null,
    expiresAt: payload.expiresAt || null,
    autoRenewEnabled:
      payload.autoRenewEnabled != null
        ? Boolean(payload.autoRenewEnabled)
        : status === 'canceled'
          ? false
          : true,
    updatedAt: now,
  };
  const entitled =
    ENTITLED_STATUSES.has(status) &&
    (subscription.expiresAt
      ? new Date(subscription.expiresAt).getTime() > Date.now()
      : status === 'active' || status === 'grace' || status === 'canceled');
  const user = updateUser(email, {
    paid: entitled,
    tier: entitled ? tier : 'locker',
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
    source: user.subscription?.source || 'apple',
    status,
    productId: productId || user.subscription?.productId || null,
    tier: user.subscription?.tier || 'locker',
    autoRenewEnabled: false,
    updatedAt: now,
    // Keep historical expiresAt when present; otherwise stamp now.
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
  ENTITLED_STATUSES,
};
