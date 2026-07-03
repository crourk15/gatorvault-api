#!/usr/bin/env node
/**
 * Provision App Store review demo account on production.
 * Creates account if missing, resets password if it exists, grants War Room tier.
 *
 * Usage:
 *   SUBSCRIPTION_ADMIN_PIN=... APP_REVIEW_PASSWORD=... node scripts/provision-app-review-account.js
 */
const API = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
const EMAIL = (process.env.APP_REVIEW_EMAIL || 'appreview@gatorvaultinsider.com').trim().toLowerCase();
const PASSWORD = process.env.APP_REVIEW_PASSWORD || '';
const PIN = process.env.SUBSCRIPTION_ADMIN_PIN || process.env.EMAIL_TEST_PIN || '';
const TIER = process.env.APP_REVIEW_TIER || 'war';

async function jfetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  if (!PASSWORD || PASSWORD.length < 12) {
    console.error('Set APP_REVIEW_PASSWORD (min 12 chars) — do not commit it to git.');
    process.exit(1);
  }
  if (!PIN) {
    console.error('Set SUBSCRIPTION_ADMIN_PIN or EMAIL_TEST_PIN for tier grant.');
    process.exit(1);
  }

  const provision = await jfetch('/api/subscription/admin/app-review', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tier: TIER, pin: PIN }),
  });

  if (provision.ok) {
    console.log('App Review account ready.');
    console.log('Email:', EMAIL);
    console.log('Created:', Boolean(provision.data?.created));
    console.log('Password reset:', Boolean(provision.data?.passwordReset));
    console.log('Tier:', provision.data?.status?.tier || TIER);
    console.log('Add these credentials to App Store Connect only (not git).');
    return;
  }

  if (provision.status === 404) {
    console.warn('Admin app-review route not deployed yet — falling back to register + grant.');
  } else {
    console.error('Provision failed:', provision.status, provision.data);
    process.exit(1);
  }

  const login = await jfetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!login.ok) {
    const reg = await jfetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'App Store Review', tier: 'locker' }),
    });
    if (!reg.ok) {
      console.error('Register failed:', reg.status, reg.data);
      console.error('Deploy latest API (app-review route) and re-run this script.');
      process.exit(1);
    }
    console.log('Registered', EMAIL);
  } else {
    console.log('Account already exists:', EMAIL);
  }

  const grant = await jfetch('/api/subscription/admin/grant', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, tier: TIER, pin: PIN }),
  });
  if (!grant.ok) {
    console.error('Grant failed:', grant.status, grant.data);
    process.exit(1);
  }

  console.log('Granted tier:', grant.data?.status?.tier || TIER);
  console.log('Demo account ready. Add credentials to App Store Connect only.');
  console.log('Email:', EMAIL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
