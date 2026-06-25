/**
 * D3 — Verified UF OV push alerts (scheduled + cancelled only).
 */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { getSessionFromReq } = require('./session-auth');
const { findUserByEmail } = require('./user-store');
const { hasPaidAccess, trialState } = require('./subscription-service');
const { getVerifiedFloridaVisitWindow } = require('./visit-intel-utils');

const STORE_PATH = path.join(__dirname, '../data/ops/push-subscriptions.json');
const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 1, subscriptions: [], dispatchFingerprints: [] };
  }
}

function writeStore(doc) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  doc.dispatchFingerprints = (doc.dispatchFingerprints || []).slice(0, 500);
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2));
}

function vapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@gatorvaultinsider.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

function pushEnabled() {
  return process.env.PUSH_ALERTS_ENABLED !== 'false' && vapidConfigured();
}

function hasSubscriberAccess(user) {
  if (!user) return false;
  if (hasPaidAccess(user)) return true;
  const trial = trialState(user);
  return !trial.expired;
}

function subscriptionKey(subscription) {
  return String(subscription?.endpoint || '');
}

function upsertSubscription(email, subscription, prefs = {}) {
  const store = readStore();
  store.subscriptions = store.subscriptions || [];
  const endpoint = subscriptionKey(subscription);
  if (!email || !endpoint) return { ok: false, error: 'invalid_subscription' };

  const row = {
    email: String(email).toLowerCase(),
    endpoint,
    keys: subscription.keys || {},
    prefs: {
      visit: prefs.visit !== false,
    },
    updatedAt: new Date().toISOString(),
  };

  const idx = store.subscriptions.findIndex((s) => s.endpoint === endpoint);
  if (idx >= 0) store.subscriptions[idx] = { ...store.subscriptions[idx], ...row };
  else store.subscriptions.push(row);

  writeStore(store);
  return { ok: true, endpoint };
}

function removeSubscription(endpoint) {
  const store = readStore();
  const before = (store.subscriptions || []).length;
  store.subscriptions = (store.subscriptions || []).filter((s) => s.endpoint !== endpoint);
  writeStore(store);
  return { ok: true, removed: before - store.subscriptions.length };
}

function updateSubscriptionPrefs(email, endpoint, prefs) {
  const store = readStore();
  const row = (store.subscriptions || []).find(
    (s) => s.endpoint === endpoint && s.email === String(email).toLowerCase()
  );
  if (!row) return { ok: false, error: 'not_found' };
  row.prefs = { ...row.prefs, ...prefs };
  row.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ok: true };
}

function eligibleRecipients() {
  const store = readStore();
  const out = [];
  for (const sub of store.subscriptions || []) {
    if (!sub.prefs?.visit) continue;
    const user = findUserByEmail(sub.email);
    if (!hasSubscriberAccess(user)) continue;
    out.push(sub);
  }
  return out;
}

function markDispatched(fingerprint) {
  if (!fingerprint) return;
  const store = readStore();
  const seen = new Set(store.dispatchFingerprints || []);
  seen.add(fingerprint);
  store.dispatchFingerprints = [...seen];
  writeStore(store);
}

function alreadyDispatched(fingerprint) {
  if (!fingerprint) return false;
  const store = readStore();
  return (store.dispatchFingerprints || []).includes(fingerprint);
}

function formatVisitWindow(log) {
  const window = getVerifiedFloridaVisitWindow(log);
  if (!window) return log.date || null;
  if (window.visitStart === window.visitEnd) return window.visitStart;
  return `${window.visitStart}–${window.visitEnd}`;
}

function buildScheduledPayload(log) {
  const name = log.playerName || log.playerSlug;
  const when = formatVisitWindow(log);
  return {
    title: 'Verified UF official visit scheduled',
    body: when
      ? `${name} has a verified UF official visit on the calendar (${when}).`
      : `${name} has a verified UF official visit on the calendar.`,
    url: `${SITE_URL}/vault/futurecast#visits`,
    tag: log.fingerprint || `visit_scheduled|${log.playerSlug}|${log.date}`,
    type: 'visit_scheduled',
    playerSlug: log.playerSlug || null,
  };
}

function buildCancelledPayload(row) {
  const name = row.playerName || row.playerSlug;
  const next = row.nextVisitSchool ? ` · now visiting ${row.nextVisitSchool}` : '';
  return {
    title: 'Verified UF official visit cancelled',
    body: `${name} cancelled his official visit to Florida${next}.`,
    url: `${SITE_URL}/vault/futurecast#visits`,
    tag: row.fingerprint || `visit_cancelled|${row.playerSlug}`,
    type: 'visit_cancelled',
    playerSlug: row.playerSlug || null,
  };
}

async function sendPushToSubscribers(payload, options = {}) {
  if (!pushEnabled()) return { ok: false, skipped: true, reason: 'push_disabled' };
  if (!ensureWebPush()) return { ok: false, skipped: true, reason: 'vapid_missing' };

  const fingerprint = options.fingerprint || payload.tag;
  if (options.dryRun) return { ok: true, dryRun: true, fingerprint, wouldSend: eligibleRecipients().length };

  if (fingerprint && alreadyDispatched(fingerprint)) {
    return { ok: true, skipped: true, reason: 'already_dispatched', fingerprint };
  }

  const recipients = eligibleRecipients();
  let sent = 0;
  let failed = 0;
  const dead = [];

  for (const sub of recipients) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag,
          type: payload.type,
          playerSlug: payload.playerSlug,
        })
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = err?.statusCode || err?.status;
      if (status === 404 || status === 410) dead.push(sub.endpoint);
    }
  }

  if (dead.length) {
    const store = readStore();
    store.subscriptions = (store.subscriptions || []).filter((s) => !dead.includes(s.endpoint));
    writeStore(store);
  }

  if (sent > 0 && fingerprint) markDispatched(fingerprint);

  return { ok: true, sent, failed, recipients: recipients.length, fingerprint };
}

async function dispatchVisitScheduledPush(log, options = {}) {
  if (!log?.playerSlug) return { ok: false, skipped: true, reason: 'invalid_log' };
  const payload = buildScheduledPayload(log);
  return sendPushToSubscribers(payload, {
    fingerprint: log.fingerprint || payload.tag,
    dryRun: options.dryRun,
  });
}

async function dispatchVisitCancelledPush(row, options = {}) {
  if (!row?.playerSlug) return { ok: false, skipped: true, reason: 'invalid_row' };
  if (row.identityConfirmed === false) return { ok: false, skipped: true, reason: 'unverified' };
  const payload = buildCancelledPayload(row);
  return sendPushToSubscribers(payload, {
    fingerprint: row.fingerprint || payload.tag,
    dryRun: options.dryRun,
  });
}

function getPublicConfig() {
  return {
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
  };
}

function requirePushSession(req, res) {
  const session = getSessionFromReq(req);
  if (!session?.email) {
    res.status(401).json({ ok: false, error: 'Sign in required.' });
    return null;
  }
  const user = findUserByEmail(session.email);
  if (!user) {
    res.status(404).json({ ok: false, error: 'Account not found.' });
    return null;
  }
  if (!hasSubscriberAccess(user)) {
    res.status(403).json({ ok: false, error: 'Active membership required for push alerts.' });
    return null;
  }
  return { session, user };
}

module.exports = {
  pushEnabled,
  getPublicConfig,
  upsertSubscription,
  removeSubscription,
  updateSubscriptionPrefs,
  dispatchVisitScheduledPush,
  dispatchVisitCancelledPush,
  buildScheduledPayload,
  buildCancelledPayload,
  requirePushSession,
  eligibleRecipients,
  alreadyDispatched,
  STORE_PATH,
};
