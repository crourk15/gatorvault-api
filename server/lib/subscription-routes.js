const { getSessionFromReq } = require('./session-auth');
const { buildCatalogPayload, tierFromProductId, normalizeTier } = require('./subscription-config');
const {
  buildSubscriptionStatus,
  applySubscription,
  appleVerificationConfigured,
  verifyAppleTransaction,
} = require('./subscription-service');
const { findUserByEmail } = require('./user-store');

const ADMIN_PIN = process.env.EMAIL_TEST_PIN || process.env.SUBSCRIPTION_ADMIN_PIN || 'GV2026admin';

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

  const user = applySubscription(session.email, {
    source: 'apple',
    status: 'active',
    productId: verified.productId || productId,
    tier,
    originalTransactionId: verified.originalTransactionId || transactionId,
    expiresAt: verified.expiresAt || null,
    appAccountToken: options.appAccountToken || null,
  });

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

function mountSubscriptionRoutes(app) {
  app.get('/api/subscription/catalog', (_req, res) => {
    res.json(buildCatalogPayload());
  });

  app.get('/api/subscription/status', (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.email) {
      return res.status(401).json({ ok: false, error: 'Sign in to view membership.' });
    }
    const user = findUserByEmail(session.email);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Account not found.' });
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
      appAccountToken: String(req.body?.appAccountToken || req.body?.app_account_token || '').trim() || null,
    });
  });

  /** Idempotent App Review demo account — create, reset password, grant War Room. */
  app.post('/api/subscription/admin/app-review', (req, res) => {
    const pin = String(req.body.pin || req.get('X-Subscription-Pin') || '').trim();
    if (!pin || pin !== ADMIN_PIN) {
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
    const pin = String(req.body.pin || req.get('X-Subscription-Pin') || '').trim();
    if (!pin || pin !== ADMIN_PIN) {
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

    return res.json({
      ok: true,
      granted: true,
      status: buildSubscriptionStatus(user),
    });
  });

  /** App Store Server Notifications V2 — decode payload when Apple IAP is configured. */
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
      const result = handleAppleServerNotification(signedPayload);
      console.log('[subscription] apple notification', result);
      return res.status(200).json({ ok: true, received: true, ...result });
    } catch (err) {
      console.error('[subscription] apple notification error', err);
      return res.status(400).json({ ok: false, error: err.message || 'Invalid notification payload.' });
    }
  });
}

module.exports = { mountSubscriptionRoutes };
