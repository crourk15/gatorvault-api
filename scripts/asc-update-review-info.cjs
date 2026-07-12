#!/usr/bin/env node
/**
 * Update App Store Review detail + attempt resolution center via ASC API.
 * Env: ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, APP_REVIEW_PASSWORD
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const KEY_PATH = process.env.ASC_KEY_PATH || path.join(process.env.USERPROFILE || '', 'Downloads', 'AuthKey_5H84AX8C73.p8');
const KEY_ID = process.env.ASC_KEY_ID || '5H84AX8C73';
const ISSUER_ID = process.env.ASC_ISSUER_ID || '';
const BUNDLE_ID = 'com.gatorvaultinsider.app';
const API = 'https://api.appstoreconnect.apple.com/v1';
const REPLY_PATH = path.join(__dirname, '..', 'docs', 'APP_STORE_RESOLUTION_REPLY_JUL3.txt');

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function jwt() {
  if (!ISSUER_ID) throw new Error('Set ASC_ISSUER_ID');
  const key = fs.readFileSync(KEY_PATH, 'utf8');
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const input = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(input), key).toString('base64url');
  return `${input}.${sig}`;
}

async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

async function main() {
  const apps = await api(`/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error(`App not found for bundle ${BUNDLE_ID}`);

  const versions = await api(`/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const version =
    versions.data?.find((v) => v.attributes?.versionString === '1.0') ||
    versions.data?.[0];
  if (!version) throw new Error('No iOS app store version found');

  let detailId = version.relationships?.appStoreReviewDetail?.data?.id;
  if (!detailId) {
    const created = await api('/appStoreReviewDetails', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreReviewDetails',
          attributes: {
            contactEmail: 'support@gatorvaultinsider.com',
            contactFirstName: 'Charles',
            contactLastName: 'Rourk',
            contactPhone: '+1-000-000-0000',
            demoAccountRequired: true,
            demoAccountName: 'appreview@gatorvaultinsider.com',
            demoAccountPassword: process.env.APP_REVIEW_PASSWORD || 'GvAppReview!2026',
            notes: fs.readFileSync(REPLY_PATH, 'utf8').slice(0, 3900),
          },
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      },
    });
    detailId = created.data.id;
    console.log('Created appStoreReviewDetail', detailId);
  } else {
    const updated = await api(`/appStoreReviewDetails/${detailId}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'appStoreReviewDetails',
          id: detailId,
          attributes: {
            demoAccountRequired: true,
            demoAccountName: 'appreview@gatorvaultinsider.com',
            demoAccountPassword: process.env.APP_REVIEW_PASSWORD || 'GvAppReview!2026',
            notes: 'Demo account reprovisioned on production with War Room access. Sign in via Join -> Sign in tab.',
          },
        },
      },
    });
    console.log('Updated appStoreReviewDetail', updated.data?.id || detailId);
  }

  console.log(JSON.stringify({ ok: true, appId: app.id, versionId: version.id, detailId }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
