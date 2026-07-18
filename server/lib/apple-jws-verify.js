/**
 * Verify App Store Server Notifications / StoreKit JWS (ES256 + x5c).
 * Trusts Apple Root CA G2/G3 bundled under server/data/apple-pki/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PKI_DIR = path.join(__dirname, '..', 'data', 'apple-pki');
const ROOT_FILES = ['AppleRootCA-G3.cer', 'AppleRootCA-G2.cer'];

let cachedRoots = null;

function loadAppleRootCerts() {
  if (cachedRoots) return cachedRoots;
  const roots = [];
  for (const name of ROOT_FILES) {
    const full = path.join(PKI_DIR, name);
    try {
      if (!fs.existsSync(full)) continue;
      roots.push(new crypto.X509Certificate(fs.readFileSync(full)));
    } catch {
      /* skip unreadable */
    }
  }
  cachedRoots = roots;
  return roots;
}

function b64urlToBuf(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodeJwsParts(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS compact serialization.');
  const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  return { header, payload, parts };
}

function certFromX5c(entry) {
  return new crypto.X509Certificate(Buffer.from(String(entry), 'base64'));
}

function assertAppleIssuer(cert) {
  const hay = `${cert.issuer}\n${cert.subject}`;
  if (!/Apple/i.test(hay)) {
    throw new Error('JWS certificate chain is not from Apple.');
  }
}

function verifyChainToAppleRoot(certs, roots) {
  if (!certs.length) throw new Error('Empty certificate chain.');
  for (let i = 0; i < certs.length - 1; i += 1) {
    const child = certs[i];
    const parent = certs[i + 1];
    if (!child.checkIssued(parent)) {
      throw new Error('Broken x5c certificate chain.');
    }
    if (!child.verify(parent.publicKey)) {
      throw new Error('x5c certificate signature failed.');
    }
  }
  const anchor = certs[certs.length - 1];
  assertAppleIssuer(anchor);
  if (!roots.length) {
    // Offline fallback — require Apple in subject/issuer only.
    return { trustedRoot: false };
  }
  for (const root of roots) {
    if (anchor.fingerprint256 === root.fingerprint256) {
      return { trustedRoot: true, rootFingerprint: root.fingerprint256 };
    }
    if (anchor.checkIssued(root) && anchor.verify(root.publicKey)) {
      return { trustedRoot: true, rootFingerprint: root.fingerprint256 };
    }
  }
  throw new Error('x5c chain does not terminate at a trusted Apple Root CA.');
}

/**
 * Cryptographically verify an Apple-signed JWS and return its payload.
 */
function verifyAppleSignedJws(signedPayload, options = {}) {
  const { header, payload, parts } = decodeJwsParts(signedPayload);
  if (String(header.alg || '').toUpperCase() !== 'ES256') {
    throw new Error(`Unsupported JWS alg: ${header.alg || 'missing'}`);
  }
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || !x5c.length) {
    throw new Error('JWS header missing x5c certificate chain.');
  }

  const certs = x5c.map(certFromX5c);
  const leaf = certs[0];
  assertAppleIssuer(leaf);

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = b64urlToBuf(parts[2]);
  const ok = crypto.verify(
    'SHA256',
    signingInput,
    { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' },
    signature
  );
  if (!ok) {
    throw new Error('Invalid Apple JWS signature.');
  }

  const roots = options.roots || loadAppleRootCerts();
  const chain = verifyChainToAppleRoot(certs, roots);

  return {
    header,
    payload,
    chain,
    leafSubject: leaf.subject,
  };
}

function decodeJwsPayloadVerified(signedPayload) {
  return verifyAppleSignedJws(signedPayload).payload;
}

module.exports = {
  PKI_DIR,
  loadAppleRootCerts,
  verifyAppleSignedJws,
  decodeJwsPayloadVerified,
  decodeJwsParts,
};
