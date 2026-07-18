/**
 * App Store Server Notifications V2 handler.
 * Verifies Apple JWS (ES256 + x5c → Apple Root CA) before mutating entitlements.
 */
'use strict';

const { verifyAppleSignedJws } = require('./apple-jws-verify');
const { tierFromProductId } = require('./subscription-config');
const { applySubscription, revokeSubscription } = require('./subscription-service');
const {
  findUserByOriginalTransactionId,
  findUserByAppAccountToken,
} = require('./user-store');

const ACTIVATE_TYPES = new Set(['SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED', 'RENEWAL_EXTENDED']);
const REVOKE_TYPES = new Set(['EXPIRED', 'REVOKE', 'REFUND', 'GRACE_PERIOD_EXPIRED']);
const GRACE_TYPES = new Set(['DID_FAIL_TO_RENEW', 'DID_ENTER_GRACE_PERIOD']);

function decodePayloadOnly(token) {
  // Payload-only decode for fixtures/tests — production path always verifies.
  const parts = String(token || '').trim().split('.');
  if (parts.length < 2) throw new Error('Invalid signedPayload JWS.');
  const mid = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = mid.length % 4 === 0 ? '' : '='.repeat(4 - (mid.length % 4));
  return JSON.parse(Buffer.from(mid + pad, 'base64').toString('utf8'));
}

function parseAppleNotification(signedPayload, { verify = true } = {}) {
  let notification;
  let chain = null;
  if (verify) {
    const verified = verifyAppleSignedJws(signedPayload);
    notification = verified.payload;
    chain = verified.chain;
  } else {
    notification = decodePayloadOnly(signedPayload);
  }

  const data = notification?.data || {};
  let transaction = null;
  if (data.signedTransactionInfo) {
    transaction = verify
      ? verifyAppleSignedJws(data.signedTransactionInfo).payload
      : decodePayloadOnly(data.signedTransactionInfo);
  }
  let renewal = null;
  if (data.signedRenewalInfo) {
    renewal = verify
      ? verifyAppleSignedJws(data.signedRenewalInfo).payload
      : decodePayloadOnly(data.signedRenewalInfo);
  }
  const type = String(
    notification?.notificationType || notification?.notification_type || ''
  ).toUpperCase();
  const subtype = String(notification?.subtype || '').toUpperCase();
  return { notification, data, transaction, renewal, type, subtype, chain };
}

function expiresAtFromTransaction(transaction) {
  const raw = transaction?.expiresDate ?? transaction?.expires_date;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

function resolveUserForTransaction(transaction) {
  const originalTxId = String(
    transaction?.originalTransactionId || transaction?.original_transaction_id || ''
  ).trim();
  if (originalTxId) {
    const byTx = findUserByOriginalTransactionId(originalTxId);
    if (byTx) return byTx;
  }
  const txId = String(transaction?.transactionId || transaction?.transaction_id || '').trim();
  if (txId) {
    const byLatest = findUserByOriginalTransactionId(txId);
    if (byLatest) return byLatest;
  }
  const accountToken = String(
    transaction?.appAccountToken || transaction?.app_account_token || ''
  ).trim();
  if (accountToken && typeof findUserByAppAccountToken === 'function') {
    const byToken = findUserByAppAccountToken(accountToken);
    if (byToken) return byToken;
  }
  return null;
}

function handleAppleServerNotification(signedPayload, options = {}) {
  const verify = options.verify !== false;
  const parsed = parseAppleNotification(signedPayload, { verify });
  const { transaction, renewal, type, subtype, chain } = parsed;
  if (!transaction?.productId && !transaction?.product_id) {
    return { ok: true, handled: false, reason: 'no_transaction', type, verified: verify };
  }

  const productId = transaction.productId || transaction.product_id;
  const tier = tierFromProductId(productId);
  if (!tier) {
    return { ok: true, handled: false, reason: 'unknown_product', productId, type, verified: verify };
  }

  const user = resolveUserForTransaction(transaction);
  if (!user) {
    return { ok: true, handled: false, reason: 'user_not_found', type, productId, verified: verify };
  }

  const originalTransactionId = String(
    transaction.originalTransactionId || transaction.transactionId || ''
  );
  const expiresAt = expiresAtFromTransaction(transaction);
  const appAccountToken =
    String(
      transaction.appAccountToken ||
        transaction.app_account_token ||
        user.subscription?.appAccountToken ||
        ''
    ).trim() || null;

  // Cancel auto-renew: keep access until expiresAt (Apple App Store rule).
  if (type === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_DISABLED') {
    applySubscription(user.email, {
      source: 'apple',
      status: 'canceled',
      productId,
      tier,
      originalTransactionId,
      expiresAt: expiresAt || user.subscription?.expiresAt || null,
      appAccountToken,
      autoRenewEnabled: false,
    });
    return {
      ok: true,
      handled: true,
      action: 'canceled_keep_access',
      email: user.email,
      type,
      subtype,
      verified: verify,
      trustedRoot: Boolean(chain?.trustedRoot),
    };
  }

  if (ACTIVATE_TYPES.has(type) || type === 'DID_CHANGE_RENEWAL_STATUS') {
    applySubscription(user.email, {
      source: 'apple',
      status: 'active',
      productId,
      tier,
      originalTransactionId,
      expiresAt,
      appAccountToken,
      autoRenewEnabled: renewal?.autoRenewStatus !== 0,
    });
    return {
      ok: true,
      handled: true,
      action: 'activated',
      email: user.email,
      type,
      verified: verify,
      trustedRoot: Boolean(chain?.trustedRoot),
    };
  }

  if (GRACE_TYPES.has(type)) {
    applySubscription(user.email, {
      source: 'apple',
      status: 'grace',
      productId,
      tier,
      originalTransactionId,
      expiresAt,
      appAccountToken,
      autoRenewEnabled: true,
    });
    return {
      ok: true,
      handled: true,
      action: 'grace',
      email: user.email,
      type,
      verified: verify,
      trustedRoot: Boolean(chain?.trustedRoot),
    };
  }

  if (REVOKE_TYPES.has(type)) {
    revokeSubscription(user.email, {
      status: type === 'REFUND' || type === 'REVOKE' ? 'revoked' : 'expired',
      productId,
    });
    return {
      ok: true,
      handled: true,
      action: 'revoked',
      email: user.email,
      type,
      verified: verify,
      trustedRoot: Boolean(chain?.trustedRoot),
    };
  }

  return {
    ok: true,
    handled: false,
    reason: 'unhandled_type',
    type,
    subtype,
    verified: verify,
  };
}

module.exports = {
  parseAppleNotification,
  handleAppleServerNotification,
};
