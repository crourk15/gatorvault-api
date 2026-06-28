'use strict';

const crypto = require('crypto');
const fetch = require('node-fetch');

const PRODUCTION_BASE = 'https://api.storekit.itunes.apple.com';
const SANDBOX_BASE = 'https://api.storekit-sandbox.itunes.apple.com';

function normalizePrivateKey(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (text.includes('BEGIN PRIVATE KEY')) return text;
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    if (decoded.includes('BEGIN PRIVATE KEY')) return decoded;
  } catch {
    /* fall through */
  }
  return text;
}

function readAppleIapConfig() {
  return {
    enabled: process.env.APPLE_IAP_VERIFICATION_ENABLED === 'true',
    keyId: String(process.env.APPLE_IAP_KEY_ID || '').trim(),
    issuerId: String(process.env.APPLE_IAP_ISSUER_ID || '').trim(),
    bundleId: String(process.env.APPLE_IAP_BUNDLE_ID || 'com.gatorvaultinsider.app').trim(),
    privateKey: normalizePrivateKey(process.env.APPLE_IAP_PRIVATE_KEY),
    sandbox: process.env.APPLE_IAP_SANDBOX === 'true',
  };
}

function isAppleIapReady(config = readAppleIapConfig()) {
  return Boolean(
    config.enabled &&
      config.keyId &&
      config.issuerId &&
      config.bundleId &&
      config.privateKey
  );
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createAppStoreJwt(config = readAppleIapConfig()) {
  if (!isAppleIapReady(config)) {
    throw new Error('Apple IAP credentials are not fully configured.');
  }
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: config.issuerId,
      iat: now,
      exp: now + 3000,
      aud: 'appstoreconnect-v1',
      bid: config.bundleId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer
    .sign(config.privateKey)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${signingInput}.${signature}`;
}

async function fetchTransaction(transactionId, config = readAppleIapConfig()) {
  const id = String(transactionId || '').trim();
  if (!id) throw new Error('transactionId is required.');
  const base = config.sandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const token = createAppStoreJwt(config);
  const res = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.errorMessage || body?.error || `Apple API HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function decodeJwsPayload(signedPayload) {
  const token = String(signedPayload || '').trim();
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid signedPayload JWS.');
  const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8'
  );
  return JSON.parse(payloadJson);
}

async function verifyStoreKitTransaction(transactionId, config = readAppleIapConfig()) {
  const body = await fetchTransaction(transactionId, config);
  const signedTransaction = body?.signedTransactionInfo || body?.signedTransaction || null;
  const decoded = signedTransaction ? decodeJwsPayload(signedTransaction) : body;
  return {
    ok: true,
    transactionId: decoded?.transactionId || transactionId,
    productId: decoded?.productId || null,
    originalTransactionId: decoded?.originalTransactionId || null,
    expiresDate: decoded?.expiresDate || null,
    environment: decoded?.environment || (config.sandbox ? 'Sandbox' : 'Production'),
    raw: decoded,
  };
}

module.exports = {
  readAppleIapConfig,
  isAppleIapReady,
  createAppStoreJwt,
  fetchTransaction,
  decodeJwsPayload,
  verifyStoreKitTransaction,
};
