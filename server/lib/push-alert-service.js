/**
 * Member push alerts — Web Push (VAPID) + native APNs device tokens.
 * Types: visit (OV), commit/flip, score (UF kickoff/final).
 */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { getSessionFromReq } = require('./session-auth');
const { findUserByEmail } = require('./user-store');
const { hasPaidAccess, trialState } = require('./subscription-service');
const { getVerifiedFloridaVisitWindow } = require('./visit-intel-utils');
const persistence = require('./push-subscription-persistence');
const { subscriberMatchesPayload } = require('./push-alert-filters');
const { apnsConfigured, sendApnsNotification } = require('./apns-push');

const STORE_PATH = path.join(__dirname, '../data/ops/push-subscriptions.json');
const SITE_URL = (process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
let initPromise = null;

function normalizeFollowPlayers(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((entry) => String(entry || '').trim()).filter(Boolean))].slice(0, 24);
}

/** Preserve visit default true when only legacy { visit } was stored. */
function normalizePrefsCompat(prefs = {}) {
  const hasVisit = Object.prototype.hasOwnProperty.call(prefs, 'visit');
  return {
    visit: hasVisit ? Boolean(prefs.visit) : true,
    commit: Boolean(prefs.commit),
    score: Boolean(prefs.score),
    followPlayers: normalizeFollowPlayers(prefs.followPlayers),
  };
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 2, subscriptions: [], deviceTokens: [], dispatchFingerprints: [] };
  }
}

function writeStore(doc, { syncPostgres = true } = {}) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  doc.version = 2;
  doc.dispatchFingerprints = (doc.dispatchFingerprints || []).slice(0, 500);
  doc.deviceTokens = doc.deviceTokens || [];
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2));
  if (syncPostgres && persistence.isEnabled()) {
    persistence.persistDoc(doc).catch((err) => {
      console.warn('[push-store] postgres sync failed:', err.message);
    });
  }
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
  return process.env.PUSH_ALERTS_ENABLED !== 'false' && (vapidConfigured() || apnsConfigured());
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
    prefs: normalizePrefsCompat(prefs),
    updatedAt: new Date().toISOString(),
  };

  const idx = store.subscriptions.findIndex((s) => s.endpoint === endpoint);
  if (idx >= 0) store.subscriptions[idx] = { ...store.subscriptions[idx], ...row };
  else store.subscriptions.push(row);

  writeStore(store);
  return { ok: true, endpoint };
}

function upsertDeviceToken(email, token, prefs = {}, platform = 'ios') {
  const store = readStore();
  store.deviceTokens = store.deviceTokens || [];
  const normalizedToken = String(token || '').replace(/\s+/g, '');
  if (!email || !normalizedToken) return { ok: false, error: 'invalid_token' };

  const row = {
    email: String(email).toLowerCase(),
    token: normalizedToken,
    platform: platform || 'ios',
    prefs: normalizePrefsCompat(prefs),
    updatedAt: new Date().toISOString(),
  };

  const idx = store.deviceTokens.findIndex((d) => d.token === normalizedToken);
  if (idx >= 0) store.deviceTokens[idx] = { ...store.deviceTokens[idx], ...row };
  else store.deviceTokens.push(row);

  writeStore(store);
  return { ok: true, token: normalizedToken };
}

function removeDeviceToken(token) {
  const store = readStore();
  const before = (store.deviceTokens || []).length;
  store.deviceTokens = (store.deviceTokens || []).filter((d) => d.token !== token);
  writeStore(store);
  return { ok: true, removed: before - store.deviceTokens.length };
}

function removeDeviceTokensForEmail(email, platform = null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'invalid_email' };
  const store = readStore();
  const before = (store.deviceTokens || []).length;
  store.deviceTokens = (store.deviceTokens || []).filter((d) => {
    if (String(d.email || '').toLowerCase() !== normalized) return true;
    if (platform && d.platform !== platform) return true;
    return false;
  });
  const removed = before - store.deviceTokens.length;
  if (removed) writeStore(store);
  return { ok: true, removed };
}

function removeSubscription(endpoint) {
  const store = readStore();
  const before = (store.subscriptions || []).length;
  store.subscriptions = (store.subscriptions || []).filter((s) => s.endpoint !== endpoint);
  writeStore(store);
  return { ok: true, removed: before - store.subscriptions.length };
}

function removeSubscriptionsForEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'invalid_email' };
  const store = readStore();
  const beforeSubs = (store.subscriptions || []).length;
  const beforeDevices = (store.deviceTokens || []).length;
  store.subscriptions = (store.subscriptions || []).filter(
    (sub) => String(sub.email || '').toLowerCase() !== normalized
  );
  store.deviceTokens = (store.deviceTokens || []).filter(
    (d) => String(d.email || '').toLowerCase() !== normalized
  );
  const removed = beforeSubs - store.subscriptions.length;
  const devicesRemoved = beforeDevices - store.deviceTokens.length;
  if (removed || devicesRemoved) writeStore(store);
  return { ok: true, removed, devicesRemoved };
}

function updateSubscriptionPrefs(email, endpoint, prefs) {
  const store = readStore();
  const row = (store.subscriptions || []).find(
    (s) => s.endpoint === endpoint && s.email === String(email).toLowerCase()
  );
  if (!row) return { ok: false, error: 'not_found' };
  row.prefs = normalizePrefsCompat({ ...row.prefs, ...prefs });
  row.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ok: true };
}

function prefsWantsType(prefs, type) {
  const p = normalizePrefsCompat(prefs || {});
  if (type === 'visit' || type === 'visit_scheduled' || type === 'visit_cancelled') return p.visit;
  if (type === 'commit' || type === 'flip') return p.commit;
  if (type === 'score' || type === 'score_kickoff' || type === 'score_final') return p.score;
  return false;
}

function eligibleRecipients(alertType = 'visit') {
  const store = readStore();
  const web = [];
  for (const sub of store.subscriptions || []) {
    if (!prefsWantsType(sub.prefs, alertType)) continue;
    const user = findUserByEmail(sub.email);
    if (!hasSubscriberAccess(user)) continue;
    web.push({ channel: 'web', ...sub });
  }
  const devices = [];
  for (const device of store.deviceTokens || []) {
    if (!prefsWantsType(device.prefs, alertType)) continue;
    const user = findUserByEmail(device.email);
    if (!hasSubscriberAccess(user)) continue;
    devices.push({ channel: 'apns', ...device });
  }
  return { web, devices };
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
    playerName: name,
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
    playerName: name,
  };
}

function buildCommitPayload({ eventType, player, skinny }) {
  const name = player?.name || player?.slug || 'A recruit';
  const isFlip = eventType === 'flip';
  const stars = player?.stars ? `${player.stars}★ ` : '';
  const pos = player?.pos ? ` ${player.pos}` : '';
  const year = player?.classYear ? ` '${String(player.classYear).slice(-2)}` : '';
  const slug = player?.slug || '';
  return {
    title: isFlip ? 'Gators flip' : 'Gators commit',
    body: skinny || `${stars}${name}${pos}${year} is headed to Florida.`,
    url: slug ? `${SITE_URL}/vault/recruiting/player/${slug}/` : `${SITE_URL}/vault/recruiting/`,
    tag: `commit|${eventType}|${slug}|${player?.commitDate || ''}`,
    type: eventType === 'flip' ? 'flip' : 'commit',
    playerSlug: slug || null,
    playerName: name,
  };
}

function buildScorePayload({ kind, opponent, ufScore, oppScore, detail }) {
  const opp = opponent || 'Opponent';
  if (kind === 'kickoff') {
    return {
      title: 'Gators kickoff',
      body: detail || `Florida vs ${opp} is underway.`,
      url: `${SITE_URL}/vault/live-scores/`,
      tag: `score_kickoff|${opp}|${detail || ''}`,
      type: 'score_kickoff',
      playerSlug: null,
      playerName: null,
    };
  }
  return {
    title: 'Final',
    body:
      detail ||
      (ufScore != null && oppScore != null
        ? `Florida ${ufScore} – ${opp} ${oppScore}`
        : `Florida vs ${opp} is final.`),
    url: `${SITE_URL}/vault/live-scores/`,
    tag: `score_final|${opp}|${ufScore}-${oppScore}`,
    type: 'score_final',
    playerSlug: null,
    playerName: null,
  };
}

async function sendPushToSubscribers(payload, options = {}) {
  if (!pushEnabled()) return { ok: false, skipped: true, reason: 'push_disabled' };

  const fingerprint = options.fingerprint || payload.tag;
  const alertType = options.alertType || payload.type || 'visit';

  if (options.dryRun) {
    const { web, devices } = eligibleRecipients(alertType);
    return {
      ok: true,
      dryRun: true,
      fingerprint,
      wouldSend: web.length + devices.length,
    };
  }

  if (fingerprint && alreadyDispatched(fingerprint)) {
    return { ok: true, skipped: true, reason: 'already_dispatched', fingerprint };
  }

  const { web, devices } = eligibleRecipients(alertType);
  const webRecipients = web.filter((sub) => subscriberMatchesPayload(sub, payload));
  const deviceRecipients = devices.filter((sub) => subscriberMatchesPayload(sub, payload));

  let sent = 0;
  let failed = 0;
  const deadWeb = [];
  const deadDevices = [];

  if (ensureWebPush()) {
    for (const sub of webRecipients) {
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
        if (status === 404 || status === 410) deadWeb.push(sub.endpoint);
      }
    }
  }

  if (apnsConfigured()) {
    for (const device of deviceRecipients) {
      const out = await sendApnsNotification(device.token, payload);
      if (out.ok) sent += 1;
      else {
        failed += 1;
        if (out.dead) deadDevices.push(device.token);
      }
    }
  }

  if (deadWeb.length || deadDevices.length) {
    const store = readStore();
    if (deadWeb.length) {
      store.subscriptions = (store.subscriptions || []).filter((s) => !deadWeb.includes(s.endpoint));
    }
    if (deadDevices.length) {
      store.deviceTokens = (store.deviceTokens || []).filter((d) => !deadDevices.includes(d.token));
    }
    writeStore(store);
  }

  if (sent > 0 && fingerprint) markDispatched(fingerprint);

  return {
    ok: true,
    sent,
    failed,
    recipients: webRecipients.length + deviceRecipients.length,
    fingerprint,
  };
}

async function dispatchVisitScheduledPush(log, options = {}) {
  if (!log?.playerSlug) return { ok: false, skipped: true, reason: 'invalid_log' };
  const payload = buildScheduledPayload(log);
  return sendPushToSubscribers(payload, {
    fingerprint: log.fingerprint || payload.tag,
    dryRun: options.dryRun,
    alertType: 'visit',
  });
}

async function dispatchVisitCancelledPush(row, options = {}) {
  if (!row?.playerSlug) return { ok: false, skipped: true, reason: 'invalid_row' };
  if (row.identityConfirmed === false) return { ok: false, skipped: true, reason: 'unverified' };
  const payload = buildCancelledPayload(row);
  return sendPushToSubscribers(payload, {
    fingerprint: row.fingerprint || payload.tag,
    dryRun: options.dryRun,
    alertType: 'visit',
  });
}

async function dispatchCommitPush({ eventType, player, skinny }, options = {}) {
  if (!player?.slug && !player?.name) return { ok: false, skipped: true, reason: 'invalid_player' };
  const type = eventType === 'flip' ? 'flip' : 'commit';
  const payload = buildCommitPayload({ eventType: type, player, skinny });
  return sendPushToSubscribers(payload, {
    fingerprint: options.fingerprint || payload.tag,
    dryRun: options.dryRun,
    alertType: 'commit',
  });
}

async function dispatchScorePush(event, options = {}) {
  const payload = buildScorePayload(event || {});
  return sendPushToSubscribers(payload, {
    fingerprint: options.fingerprint || payload.tag,
    dryRun: options.dryRun,
    alertType: 'score',
  });
}

function getPublicConfig() {
  return {
    enabled: pushEnabled(),
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    apnsConfigured: apnsConfigured(),
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

async function initPushAlertStore() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!persistence.isEnabled()) {
      const doc = readStore();
      return {
        mode: 'json',
        subscriptions: (doc.subscriptions || []).length,
        deviceTokens: (doc.deviceTokens || []).length,
      };
    }
    await persistence.ensureTables();
    const fromDb = await persistence.loadDoc();
    if (fromDb && ((fromDb.subscriptions || []).length || (fromDb.deviceTokens || []).length)) {
      writeStore(fromDb, { syncPostgres: false });
      return {
        mode: 'postgres',
        subscriptions: (fromDb.subscriptions || []).length,
        deviceTokens: (fromDb.deviceTokens || []).length,
      };
    }
    const local = readStore();
    if ((local.subscriptions || []).length || (local.deviceTokens || []).length) {
      await persistence.replaceDoc(local);
      return {
        mode: 'postgres-seeded-from-json',
        subscriptions: (local.subscriptions || []).length,
        deviceTokens: (local.deviceTokens || []).length,
      };
    }
    return { mode: 'postgres-empty', subscriptions: 0, deviceTokens: 0 };
  })();
  return initPromise;
}

module.exports = {
  pushEnabled,
  getPublicConfig,
  upsertSubscription,
  upsertDeviceToken,
  removeSubscription,
  removeDeviceToken,
  removeDeviceTokensForEmail,
  removeSubscriptionsForEmail,
  updateSubscriptionPrefs,
  dispatchVisitScheduledPush,
  dispatchVisitCancelledPush,
  dispatchCommitPush,
  dispatchScorePush,
  buildScheduledPayload,
  buildCancelledPayload,
  buildCommitPayload,
  buildScorePayload,
  requirePushSession,
  eligibleRecipients,
  alreadyDispatched,
  initPushAlertStore,
  STORE_PATH,
  normalizePrefs: normalizePrefsCompat,
  normalizePrefsCompat,
};
