/**
 * Apple Push Notification service (HTTP/2 + JWT).
 * Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_P8 (PEM contents) or APNS_KEY_PATH.
 * Optional: APNS_PRODUCTION=true for api.push.apple.com (default sandbox when unset in non-prod).
 */
const fs = require('fs');
const http2 = require('http2');
const crypto = require('crypto');

let cachedJwt = { token: null, exp: 0 };

function apnsConfigured() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.gatorvaultinsider.app';
  const key = loadKeyPem();
  return Boolean(keyId && teamId && bundleId && key);
}

function loadKeyPem() {
  const inline = process.env.APNS_KEY_P8 && String(process.env.APNS_KEY_P8).trim();
  if (inline) {
    return inline.includes('BEGIN PRIVATE KEY')
      ? inline.replace(/\\n/g, '\n')
      : `-----BEGIN PRIVATE KEY-----\n${inline.replace(/\s+/g, '\n')}\n-----END PRIVATE KEY-----`;
  }
  const keyPath = process.env.APNS_KEY_PATH && String(process.env.APNS_KEY_PATH).trim();
  if (keyPath && fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  return null;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getApnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt.token && cachedJwt.exp > now + 60) return cachedJwt.token;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = loadKeyPem();
  if (!keyId || !teamId || !pem) return null;

  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  const keyObject = crypto.createPrivateKey(pem);
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  });
  const token = `${signingInput}.${sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
  cachedJwt = { token, exp: now + 3500 };
  return token;
}

function apnsHost() {
  if (process.env.APNS_PRODUCTION === 'true') return 'api.push.apple.com';
  if (process.env.APNS_PRODUCTION === 'false') return 'api.sandbox.push.apple.com';
  // Default production for live App Store builds
  return 'api.push.apple.com';
}

/**
 * @param {string} deviceToken
 * @param {{ title: string, body: string, url?: string, tag?: string, type?: string }} payload
 */
function sendApnsNotification(deviceToken, payload) {
  return new Promise((resolve) => {
    if (!apnsConfigured()) {
      resolve({ ok: false, skipped: true, reason: 'apns_unconfigured' });
      return;
    }
    const jwt = getApnsJwt();
    if (!jwt) {
      resolve({ ok: false, skipped: true, reason: 'apns_jwt' });
      return;
    }

    const bundleId = process.env.APNS_BUNDLE_ID || 'com.gatorvaultinsider.app';
    const host = apnsHost();
    const token = String(deviceToken || '').replace(/\s+/g, '');
    if (!token) {
      resolve({ ok: false, skipped: true, reason: 'invalid_token' });
      return;
    }

    const body = JSON.stringify({
      aps: {
        alert: {
          title: payload.title || 'GatorVault',
          body: payload.body || '',
        },
        sound: 'default',
        'thread-id': payload.type || 'gatorvault',
      },
      url: payload.url || 'https://gatorvaultinsider.com/vault/alerts/',
      type: payload.type || null,
      tag: payload.tag || null,
      playerSlug: payload.playerSlug || null,
    });

    const client = http2.connect(`https://${host}`);
    client.on('error', (err) => {
      resolve({ ok: false, error: err.message });
      try {
        client.close();
      } catch {
        /* ok */
      }
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });

    let status = 0;
    let responseBody = '';
    req.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    req.on('end', () => {
      try {
        client.close();
      } catch {
        /* ok */
      }
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status });
        return;
      }
      resolve({
        ok: false,
        status,
        error: responseBody || `apns_status_${status}`,
        dead: status === 410 || status === 400,
      });
    });
    req.on('error', (err) => {
      try {
        client.close();
      } catch {
        /* ok */
      }
      resolve({ ok: false, error: err.message });
    });
    req.end(body);
  });
}

module.exports = {
  apnsConfigured,
  sendApnsNotification,
};
