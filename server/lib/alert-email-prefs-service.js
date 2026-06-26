/**
 * Email alert preferences — instant visit alerts + weekly verified OV digest eligibility.
 */
const { findUserByEmail } = require("./user-store");
const { hasPaidAccess, trialState } = require("./subscription-service");
const { getSessionFromReq } = require("./session-auth");
const { subscriberMatchesPayload } = require("./push-alert-filters");
const persistence = require("./alert-email-persistence");

function normalizeFollowPlayers(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((entry) => String(entry || "").trim()).filter(Boolean))].slice(0, 24);
}

function normalizePrefs(prefs = {}) {
  const method = ["push", "email", "both"].includes(prefs.method) ? prefs.method : "email";
  const freq = ["instant", "daily", "weekly"].includes(prefs.freq) ? prefs.freq : "weekly";
  return {
    method,
    freq,
    visit: prefs.visit !== false,
    followPlayers: normalizeFollowPlayers(prefs.followPlayers),
  };
}

function hasSubscriberAccess(user) {
  if (!user) return false;
  if (hasPaidAccess(user)) return true;
  return !trialState(user).expired;
}

function wantsEmailVisitDigest(prefs) {
  if (!prefs?.visit) return false;
  if (prefs.method !== "email" && prefs.method !== "both") return false;
  return prefs.freq === "weekly" || prefs.freq === "daily";
}

function wantsEmailVisitInstant(prefs) {
  if (!prefs?.visit) return false;
  if (prefs.method !== "email" && prefs.method !== "both") return false;
  return prefs.freq === "instant";
}

function filterRecapRowsForSubscriber(rows, prefs) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (!prefs?.followPlayers?.length) return rows;
  return rows.filter((row) =>
    subscriberMatchesPayload(
      { prefs: { followPlayers: prefs.followPlayers } },
      { playerSlug: row.slug, playerName: row.name }
    )
  );
}

async function upsertEmailAlertPrefs(email, prefs) {
  return persistence.upsertPref(email, normalizePrefs(prefs));
}

async function listEligibleVisitInstantRecipients() {
  const rows = await persistence.loadAllPrefs();
  const out = [];
  for (const row of rows) {
    const prefs = normalizePrefs(row.prefs);
    if (!wantsEmailVisitInstant(prefs)) continue;
    const user = findUserByEmail(row.email);
    if (!hasSubscriberAccess(user)) continue;
    out.push({ email: row.email, prefs, user });
  }
  return out;
}

async function listEligibleVisitDigestRecipients({ freq = "weekly" } = {}) {
  const rows = await persistence.loadAllPrefs();
  const out = [];
  for (const row of rows) {
    const prefs = normalizePrefs(row.prefs);
    if (!wantsEmailVisitDigest(prefs)) continue;
    if (freq === "weekly" && prefs.freq !== "weekly") continue;
    if (freq === "daily" && prefs.freq !== "daily") continue;
    const user = findUserByEmail(row.email);
    if (!hasSubscriberAccess(user)) continue;
    out.push({ email: row.email, prefs, user });
  }
  return out;
}

function requireAlertEmailSession(req, res) {
  const session = getSessionFromReq(req);
  if (!session?.email) {
    res.status(401).json({ ok: false, error: "Sign in required." });
    return null;
  }
  const user = findUserByEmail(session.email);
  if (!user) {
    res.status(404).json({ ok: false, error: "Account not found." });
    return null;
  }
  if (!hasSubscriberAccess(user)) {
    res.status(403).json({ ok: false, error: "Active membership required for email alerts." });
    return null;
  }
  return { session, user };
}

async function initAlertEmailPrefsStore() {
  return persistence.initAlertEmailPrefsStore();
}

module.exports = {
  normalizePrefs,
  wantsEmailVisitDigest,
  wantsEmailVisitInstant,
  filterRecapRowsForSubscriber,
  upsertEmailAlertPrefs,
  listEligibleVisitDigestRecipients,
  listEligibleVisitInstantRecipients,
  requireAlertEmailSession,
  initAlertEmailPrefsStore,
};