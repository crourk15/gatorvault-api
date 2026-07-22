/**
 * Deterministic UUID-shaped StoreKit appAccountToken (no PII in cleartext).
 * Must match client/lib/ios-iap.ts appAccountTokenForEmail.
 */
function appAccountTokenForEmail(email) {
  const seed = `gatorvault:${String(email || '').trim().toLowerCase()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  const p = (n, len) => (n >>> 0).toString(16).padStart(len, '0').slice(0, len);
  return `${p(h1, 8)}-${p(h1 >>> 8, 4)}-4${p(h2, 3)}-a${p(h2 >>> 4, 3)}-${p(h1 ^ h2, 12)}`;
}

module.exports = { appAccountTokenForEmail };
