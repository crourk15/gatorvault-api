'use strict';

const { decodeJwsPayload } = require('./apple-iap-verify');
const { tierFromProductId } = require('./subscription-config');
const { applySubscription, revokeSubscription } = require('./subscription-service');
const {
  findUserByOriginalTransactionId,
  findUserByAppAccountToken,
} = require('./user-store');

const ACTIVATE_TYPES = new Set(['SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED', 'RENEWAL_EXTENDED']);
const REVOKE_TYPES = new Set(['EXPIRED', 'REVOKE', 'REFUND', 'GRACE_PERIOD_EXPIRED']);
const GRACE_TYPES = new Set(['DID_FAIL_TO_RENEW', 'DID_ENTER_GRACE_PERIOD']);

function parseAppleNotification(signedPayload) {
  const notification = decodeJwsPayload(signedPayload);
  const data = notification?.data || {};
  let transaction = null;
  if (data.signedTransactionInfo) {
    transaction = decodeJwsPayload(data.signedTransactionInfo);
  }
  let renewal = null;
  if (data.signedRenewalInfo) {
    renewal = decodeJwsPayload(data.signedRenewalInfo);
  }
  const type = String(
    notification?.notificationType || notification?.notification_type || ''
  ).toUpperCase();
  const subtype = String(notification?.subtype || '').toUpperCase();
  return { notification, data, transaction, renewal, type, subtype };
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

function handleAppleServerNotification(signedPayload) {
  const parsed = parseAppleNotification(signedPayload);
  const { transaction, renewal, type, subtype } = parsed;
  if (!transaction?.productId && !transaction?.product_id) {
    return { ok: true, handled: false, reason: 'no_transaction', type };
  }

  const productId = transaction.productId || transaction.product_id;
  const tier = tierFromProductId(productId);
  if (!tier) {
    return { ok: true, handled: false, reason: 'unknown_product', productId, type };
  }

  const user = resolveUserForTransaction(transaction);
  if (!user) {
    return { ok: true, handled: false, reason: 'user_not_found', type, productId };
  }

  const originalTransactionId = String(
    transaction.originalTransactionId || transaction.transactionId || ''
  );
  const expiresAt = expiresAtFromTransaction(transaction);
  const appAccountToken = String(
    transaction.appAccountToken || transaction.app_account_token || user.subscription?.appAccountToken || ''
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
    return { ok: true, handled: true, action: 'activated', email: user.email, type };
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
    return { ok: true, handled: true, action: 'grace', email: user.email, type };
  }

  if (REVOKE_TYPES.has(type)) {
    revokeSubscription(user.email, {
      status: type === 'REFUND' || type === 'REVOKE' ? 'revoked' : 'expired',
      productId,
    });
    return { ok: true, handled: true, action: 'revoked', email: user.email, type };
  }

  return { ok: true, handled: false, reason: 'unhandled_type', type, subtype };
}

module.exports = {
  parseAppleNotification,
  handleAppleServerNotification,
};
