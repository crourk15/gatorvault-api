const { getSessionFromReq } = require('./session-auth');
const { verifyAdminPin, pinFromReq } = require('./admin-pin');
const { buildCatalogPayload, tierFromProductId, normalizeTier } = require('./subscription-config');
const {
  buildSubscriptionStatus,
  applySubscription,
  appleVerificationConfigured,
  verifyAppleTransaction,
} = require('./subscription-service');
const { findUserByEmail, findUserByOriginalTransactionId } = require('./user-store');
const { appAccountTokenForEmail } = require('./app-account-token');
const {
  maybeSendPaidMembershipConfirmation,
  isInitialPaidActivationNotification,
} = require('./membership-confirm');

function queuePaidConfirmation(userBefore, userAfter, deliverEmail) {
  if (typeof deliverEmail !== 'function' || !userAfter) return;
  setImmediate(() => {
    maybeSendPaidMembershipConfirmation(userBefore, userAfter, { deliverEmail }).catch((err) => {
      console.warn('[subscription] paid confirmation email failed', err?.message || err);
    });
  });
}

async function processVerifiedApplePurchase(session, productId, transactionId, res, options = {}) {
  const tier = tierFromProductId(productId);
  if (!tier) {
    return res.status(400).json({ ok: false, error: 'Unknown App Store product ID.' });
  }

  if (!appleVerificationConfigured()) {
    return res.status(503).json({
      ok: false,
      ready: false,
      error: 'Apple IAP verification is not enabled on the server yet.',
      hint: 'Complete Step 3b: set APPLE_IAP_VERIFICATION_ENABLED=true and configure App Store Connect keys.',
      acceptedProductId: productId,
      mappedTier: tier,
      transactionId: transactionId || null,
    });
  }

  if (!transactionId) {
    return res.status(400).json({ ok: false, error: 'transactionId is required when Apple IAP is enabled.' });
  }

  let verified;
  try {
    verified = await verifyAppleTransaction(transactionId);
  } catch (err) {
    if (err?.code === 'subscription_expired') {
      return res.status(402).json({
        ok: false,
        expired: true,
        error: err.message || 'This Apple subscription is no longer active.',
      });
    }
    return res.status(502).json({
      ok: false,
      error: err.message || 'Apple transaction verification failed.',
    });
  }

  if (verified.productId && verified.productId !== productId) {
    return res.status(400).json({
      ok: false,
      error: 'Product ID does not match verified Apple transaction.',
      verifiedProductId: verified.productId,
    });
  }

  if (verified.expiresAt && new Date(verified.expiresAt).getTime() <= Date.now()) {
    return res.status(402).json({
      ok: false,
      expired: true,
      error: 'This Apple subscription is no longer active.',
      expiresAt: verified.expiresAt,
    });
  }

  const sessionEmail = String(session.email || '').trim().toLowerCase();
  const originalTx = String(verified.originalTransactionId || transactionId || '').trim();
  if (originalTx) {
    const owner = findUserByOriginalTransactionId(originalTx);
    if (owner && String(owner.email || '').trim().toLowerCase() !== sessionEmail) {
      return res.status(409).json({
        ok: false,
        error:
          'This Apple subscription is already linked to a different GatorVault account. Sign in with that email or contact support.',
        code: 'subscription_linked_elsewhere',
      });
    }
  }

  const expectedToken = appAccountTokenForEmail(sessionEmail);
  const incomingToken = String(options.appAccountToken || '').trim().toLowerCase();
  const appleToken = String(verified.appAccountToken || '').trim().toLowerCase();
  if (appleToken && appleToken !== expectedToken.toLowerCase()) {
    return res.status(403).json({
      ok: false,
      error: 'This Apple purchase is tied to a different GatorVault account token.',
      code: 'app_account_token_mismatch',
    });
  }
  if (incomingToken && incomingToken !== expectedToken.toLowerCase()) {
    return res.status(403).json({
      ok: false,
      error: 'appAccountToken does not match the signed-in account.',
      code: 'app_account_token_mismatch',
    });
  }

  const userBefore = findUserByEmail(session.email);
  const user = applySubscription(session.email, {
    source: 'apple',
    status: 'active',
    productId: verified.productId || productId,
    tier,
    originalTransactionId: originalTx || transactionId,
    expiresAt: verified.expiresAt || null,
    appAccountToken: expectedToken,
    autoRenewEnabled: true,
  });

  queuePaidConfirmation(userBefore, user, options.deliverEmail);

  return res.json({
    ok: true,
    verified: true,
    restored: Boolean(options.restored),
    apple: {
      transactionId: verified.transactionId,
      environment: verified.environment,
    },
    status: buildSubscriptionStatus(user),
  });
}

function buildBillingHealth() {
  const { isAppleIapReady, readAppleIapConfig } = require('./apple-iap-verify');
  const { loadAppleRootCerts } = require('./apple-jws-verify');
  const { getRecentNotifications } = require('./apple-iap-notification-log');
  const catalog = buildCatalogPayload();
  const cfg = readAppleIapConfig();
  const roots = loadAppleRootCerts();
  const recent = getRecentNotifications(5);
  return {
    ok: true,
    elite: Boolean(isAppleIapReady(cfg) && roots.length >= 1),
    appleIap: {
      verificationEnabled: cfg.enabled,
      configured: isAppleIapReady(cfg),
      keyId: cfg.keyId || null,
      bundleId: cfg.bundleId || null,
      sandbox: cfg.sandbox,
      rootCertsLoaded: roots.length,
    },
    catalog: {
      iosPurchaseReady: catalog.iosPurchaseReady,
      appStoreUrl: catalog.appStoreUrl,
      appAppleId: catalog.appAppleId,
    },
    notifications: {
      url: catalog.notificationsUrl,
      version: 'v2',
      jwsVerification: 'required',
      connectSetup:
        'App Store Connect → App → App Information → App Store Server Notifications → Production URL',
      recentCount: recent.entries.length,
      durableLog: recent.durable,
      lastAt: recent.updatedAt,
    },
    webCheckoutEnabled: false,
  };
}

function mountSubscriptionRoutes(app, deps = {}) {
  const deliverEmail = typeof deps.deliverEmail === 'function' ? deps.deliverEmail : null;

  app.get('/api/subscription/catalog', (_req, res) => {
    res.json(buildCatalogPayload());
  });

  /** Public billing readiness — safe (no secrets). */
  app.get('/api/subscription/health', (_req, res) => {
    res.json(buildBillingHealth());
  });

  app.get('/api/subscription/status', (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in to view membership.' });
    }
    const user = findUserByEmail(session.email);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Account not found. Sign in again.' });
    }
    return res.json(buildSubscriptionStatus(user));
  });

  /** Step 3b: full StoreKit receipt / transaction verification. */
  app.post('/api/subscription/apple/verify', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in required.' });
    }

    const productId = String(req.body.productId || req.body.product_id || '').trim();
    const transactionId = String(req.body.transactionId || req.body.transaction_id || '').trim();

    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId is required.' });
    }

    return processVerifiedApplePurchase(session, productId, transactionId, res, {
      deliverEmail,
      appAccountToken: String(req.body?.appAccountToken || req.body?.app_account_token || '').trim() || null,
    });
  });

  /** Restore latest StoreKit transaction after native restorePurchases(). */
  app.post('/api/subscription/apple/restore', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in required.' });
    }

    const productId = String(req.body.productId || req.body.product_id || '').trim();
    const transactionId = String(req.body.transactionId || req.body.transaction_id || '').trim();

    if (!productId || !transactionId) {
      return res.status(400).json({
        ok: false,
        error: 'productId and transactionId are required to restore Apple subscription access.',
      });
    }

    return processVerifiedApplePurchase(session, productId, transactionId, res, {
      restored: true,
      deliverEmail,
      appAccountToken: String(req.body?.appAccountToken || req.body?.app_account_token || '').trim() || null,
    });
  });

  /** Idempotent App Review demo account — create, reset password, grant War Room. */
  app.post('/api/subscription/admin/app-review', (req, res) => {
    const pin = String(req.body.pin || req.get('X-Subscription-Pin') || pinFromReq(req) || '').trim();
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN.' });
    }

    const { provisionAppReviewAccount } = require('./app-review-provision');
    const email = String(req.body.email || process.env.APP_REVIEW_EMAIL || 'appreview@gatorvaultinsider.com')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || process.env.APP_REVIEW_PASSWORD || '').trim();
    const tier = normalizeTier(req.body.tier || process.env.APP_REVIEW_TIER || 'war');

    const result = provisionAppReviewAccount({ email, password, tier });
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      email: result.email,
      created: result.created,
      passwordReset: result.passwordReset,
      status: result.statusPayload,
    });
  });

  /** Manual grant until IAP is live — protected by admin PIN. */
  app.post('/api/subscription/admin/grant', (req, res) => {
    const pin = String(req.body.pin || req.get('X-Subscription-Pin') || pinFromReq(req) || '').trim();
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN.' });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const tier = normalizeTier(req.body.tier);
    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required.' });
    }

    const existing = findUserByEmail(email);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Account not found.' });
    }

    const user = applySubscription(email, {
      source: 'manual',
      status: 'active',
      productId: `manual.${tier}`,
      tier,
      originalTransactionId: null,
      expiresAt: req.body.expiresAt || null,
    });

    queuePaidConfirmation(existing, user, deliverEmail);

    return res.json({
      ok: true,
      granted: true,
      status: buildSubscriptionStatus(user),
    });
  });

  /** App Store Server Notifications V2 — cryptographically verified JWS. */
  app.post('/api/subscription/apple/notifications', async (req, res) => {
    if (!appleVerificationConfigured()) {
      return res.status(503).json({ ok: false, error: 'Apple notifications not configured.' });
    }
    try {
      const signedPayload = String(req.body?.signedPayload || '').trim();
      if (!signedPayload) {
        return res.status(400).json({ ok: false, error: 'signedPayload is required.' });
      }
      const { handleAppleServerNotification } = require('./apple-iap-notifications');
      const { appendNotification } = require('./apple-iap-notification-log');
      const result = handleAppleServerNotification(signedPayload, { verify: true });
      if (
        result.handled &&
        result.action === 'activated' &&
        result.email &&
        isInitialPaidActivationNotification(result.type, result.subtype)
      ) {
        const after = findUserByEmail(result.email);
        queuePaidConfirmation(
          { paidConfirmationSentAt: after?.paidConfirmationSentAt || null },
          after,
          deliverEmail
        );
      }
      try {
        appendNotification({
          type: result.type || null,
          action: result.action || null,
          handled: Boolean(result.handled),
          reason: result.reason || null,
          email: result.email || null,
          verified: Boolean(result.verified),
          trustedRoot: Boolean(result.trustedRoot),
        });
      } catch (logErr) {
        console.warn('[subscription] notification log failed', logErr.message);
      }
      console.log('[subscription] apple notification', {
        handled: result.handled,
        action: result.action,
        type: result.type,
        verified: result.verified,
      });
      return res.status(200).json({ ok: true, received: true, ...result });
    } catch (err) {
      console.error('[subscription] apple notification error', err);
      return res.status(400).json({ ok: false, error: err.message || 'Invalid notification payload.' });
    }
  });
}

module.exports = { mountSubscriptionRoutes, buildBillingHealth };
