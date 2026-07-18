const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  loadAppleRootCerts,
  verifyAppleSignedJws,
  decodeJwsParts,
} = require('../../lib/apple-jws-verify');

describe('apple-jws-verify', () => {
  it('loads bundled Apple Root CA certificates', () => {
    const roots = loadAppleRootCerts();
    assert.ok(roots.length >= 1);
    assert.match(roots[0].subject, /Apple Root CA/i);
  });

  it('rejects compact JWS without x5c', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ping: true })).toString('base64url');
    const sig = Buffer.from('00').toString('base64url');
    assert.throws(() => verifyAppleSignedJws(`${header}.${payload}.${sig}`), /x5c/i);
  });

  it('decodeJwsParts reads header and payload', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', x5c: ['AA'] })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ notificationType: 'TEST' })).toString('base64url');
    const parsed = decodeJwsParts(`${header}.${payload}.sig`);
    assert.equal(parsed.header.alg, 'ES256');
    assert.equal(parsed.payload.notificationType, 'TEST');
  });
});
