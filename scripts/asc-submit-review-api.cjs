#!/usr/bin/env node
/**
 * Submit GatorVault Insider 1.0.5 / build 25 for App Review via App Store Connect API.
 * No browser / 2FA — uses the same ASC API key Codemagic already has.
 *
 * Required env:
 *   ASC_ISSUER_ID   — UUID from App Store Connect → Users and Access → Keys
 *   ASC_KEY_ID      — default 5H84AX8C73
 *   ASC_KEY_PATH    — path to AuthKey_*.p8  OR  ASC_PRIVATE_KEY = PEM contents
 *
 * Optional:
 *   ASC_VERSION     — default 1.0.5
 *   ASC_BUILD       — default 25
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const KEY_ID = process.env.ASC_KEY_ID || '5H84AX8C73';
const ISSUER_ID = process.env.ASC_ISSUER_ID || '';
const KEY_PATH =
  process.env.ASC_KEY_PATH ||
  path.join(process.env.HOME || '', 'Downloads', `AuthKey_${KEY_ID}.p8`);
const VERSION = process.env.ASC_VERSION || '1.0.5';
const BUILD = String(process.env.ASC_BUILD || '25');
const BUNDLE_ID = 'com.gatorvaultinsider.app';
const API = 'https://api.appstoreconnect.apple.com/v1';
const WHATS_NEW =
  process.env.ASC_WHATS_NEW ||
  'Membership & Account stays open if the network blips — no more bounce to the landing page. Sign-in no longer drops while you browse FutureCast and other vault tabs. Player high school vs hometown display fix. Game Zone and Alerts fan-facing copy cleanup.';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function loadPrivateKey() {
  if (process.env.ASC_PRIVATE_KEY) {
    return process.env.ASC_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(
      `Missing ASC private key. Set ASC_PRIVATE_KEY or put the .p8 at ${KEY_PATH} (and set ASC_ISSUER_ID).`
    );
  }
  return fs.readFileSync(KEY_PATH, 'utf8');
}

function jwt() {
  if (!ISSUER_ID) throw new Error('Set ASC_ISSUER_ID (UUID from App Store Connect API keys page).');
  const key = loadPrivateKey();
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })
  );
  const input = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(input), {
    key,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
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
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} -> ${res.status} ${JSON.stringify(data).slice(0, 800)}`);
  }
  return data;
}

async function ensureWhatsNew(versionId) {
  const locs = await api(
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=20`
  );
  const en =
    locs.data?.find((l) => l.attributes?.locale === 'en-US') || locs.data?.[0];
  if (!en) {
    console.log('[asc-api] No localization found — skipping What\'s New.');
    return;
  }
  const current = en.attributes?.whatsNew || '';
  if (current && current.trim().length > 10) {
    console.log('[asc-api] What\'s New already set.');
    return;
  }
  await api(`/appStoreVersionLocalizations/${en.id}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'appStoreVersionLocalizations',
        id: en.id,
        attributes: { whatsNew: WHATS_NEW.slice(0, 4000) },
      },
    },
  });
  console.log('[asc-api] Set What\'s New.');
}

async function attachBuild(versionId, buildId) {
  await api(`/appStoreVersions/${versionId}/relationships/build`, {
    method: 'PATCH',
    body: {
      data: { type: 'builds', id: buildId },
    },
  });
  console.log('[asc-api] Attached build', BUILD, '-> version', VERSION);
}

async function submitReview(appId, versionId) {
  // Reuse open submission if present
  let submissionId = null;
  const existing = await api(
    `/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=5`
  ).catch(() => ({ data: [] }));

  const open = (existing.data || []).find((s) =>
    /READY_FOR_REVIEW|UNRESOLVED|WAITING|IN_REVIEW/i.test(s.attributes?.state || '')
  );
  if (open?.attributes?.state === 'WAITING_FOR_REVIEW' || open?.attributes?.state === 'IN_REVIEW') {
    return { already: true, state: open.attributes.state, id: open.id };
  }
  if (open) submissionId = open.id;

  if (!submissionId) {
    const created = await api('/reviewSubmissions', {
      method: 'POST',
      body: {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: {
            app: { data: { type: 'apps', id: appId } },
          },
        },
      },
    });
    submissionId = created.data.id;
    console.log('[asc-api] Created reviewSubmission', submissionId);
  } else {
    console.log('[asc-api] Reusing reviewSubmission', submissionId, open.attributes?.state);
  }

  // Add version item if needed
  const items = await api(`/reviewSubmissions/${submissionId}/items?limit=20`).catch(() => ({
    data: [],
  }));
  const hasVersion = (items.data || []).some(
    (it) => it.relationships?.appStoreVersion?.data?.id === versionId
  );
  if (!hasVersion) {
    await api('/reviewSubmissionItems', {
      method: 'POST',
      body: {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
          },
        },
      },
    });
    console.log('[asc-api] Added version item to submission.');
  }

  const submitted = await api(`/reviewSubmissions/${submissionId}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'reviewSubmissions',
        id: submissionId,
        attributes: { submitted: true },
      },
    },
  });
  return {
    already: false,
    state: submitted.data?.attributes?.state || 'SUBMITTED',
    id: submissionId,
  };
}

async function main() {
  console.log('[asc-api] Submitting', VERSION, 'build', BUILD, 'key', KEY_ID);

  const apps = await api(`/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) throw new Error(`App not found for ${BUNDLE_ID}`);
  console.log('[asc-api] App id', app.id);

  const versions = await api(
    `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`
  );
  let version = versions.data?.find((v) => v.attributes?.versionString === VERSION);
  if (!version) {
    const created = await api('/appStoreVersions', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreVersions',
          attributes: {
            platform: 'IOS',
            versionString: VERSION,
            releaseType: 'MANUAL',
          },
          relationships: {
            app: { data: { type: 'apps', id: app.id } },
          },
        },
      },
    });
    version = created.data;
    console.log('[asc-api] Created version', VERSION, version.id);
  } else {
    console.log(
      '[asc-api] Found version',
      VERSION,
      version.id,
      version.attributes?.appStoreState
    );
  }

  const builds = await api(
    `/builds?filter[app]=${app.id}&filter[version]=${BUILD}&filter[processingState]=VALID&limit=10`
  );
  const build =
    builds.data?.find((b) => String(b.attributes?.version) === BUILD) || builds.data?.[0];
  if (!build) {
    throw new Error(
      `Build ${BUILD} not found (or still processing). Wait for TestFlight processing, then re-run.`
    );
  }
  console.log('[asc-api] Build id', build.id, 'state', build.attributes?.processingState);

  const state = version.attributes?.appStoreState || '';
  if (!/WAITING_FOR_REVIEW|IN_REVIEW|PENDING_APPLE_RELEASE|READY_FOR_SALE/i.test(state)) {
    await attachBuild(version.id, build.id);
    await ensureWhatsNew(version.id);
  } else {
    console.log('[asc-api] Version already in review/release state:', state);
  }

  const result = await submitReview(app.id, version.id);
  console.log(JSON.stringify({ ok: true, version: VERSION, build: BUILD, ...result }, null, 2));
}

main().catch((err) => {
  console.error('[asc-api] FATAL:', err.message || err);
  process.exit(1);
});
