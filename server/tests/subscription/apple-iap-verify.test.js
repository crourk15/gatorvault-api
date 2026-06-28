const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeJwsPayload, isAppleIapReady, readAppleIapConfig } = require('../../lib/apple-iap-verify');

test('decodeJwsPayload parses middle segment JSON', () => {
  const payload = { productId: 'com.gatorvaultinsider.film.monthly', transactionId: 'abc123' };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `header.${encoded}.signature`;
  assert.deepEqual(decodeJwsPayload(token), payload);
});

test('isAppleIapReady false until all env vars present', () => {
  const prev = { ...process.env };
  process.env.APPLE_IAP_VERIFICATION_ENABLED = 'true';
  delete process.env.APPLE_IAP_KEY_ID;
  delete process.env.APPLE_IAP_ISSUER_ID;
  delete process.env.APPLE_IAP_PRIVATE_KEY;
  assert.equal(isAppleIapReady(readAppleIapConfig()), false);
  Object.assign(process.env, prev);
});
