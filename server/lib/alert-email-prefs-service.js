/**
 * Email alert preferences — instant visit alerts + weekly verified OV digest eligibility.
 */
const { findUserByEmail, indexUsersByEmail, loadUsers } = require("./user-store");
const { hasPaidAccess, trialState } = require("./subscription-service");
const { getSessionFromReq } = require("./session-auth");
const { subscriberMatchesPayload } = require("./push-alert-filters");
const persistence = require("./alert-email-persistence");

function normalizeFollowPlayers(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((entry) => String(entry || "").trim()).filter(Boolean))].slice(0, 24);
}

function normalizePrefs(prefs = {}) {
  // Default instant — fans expect a ping when a verified UF OV is scheduled.
  // Weekly/daily remain available when explicitly chosen.
  const method = ["push", "email", "both"].includes(prefs.method) ? prefs.method : "email";
  const freq = ["instant", "daily", "weekly"].includes(prefs.freq) ? prefs.freq : "instant";
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

async function getEmailAlertPrefs(email) {
  const row = await persistence.getPref(email);
  if (!row) return null;
  return {
    email: row.email,
    prefs: normalizePrefs(row.prefs),
    updatedAt: row.updatedAt || null,
  };
}

function nextDigestAtUtc(hourUtc, weekday, now = new Date()) {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(hourUtc);
  if (weekday == null) {
    if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }
  for (let i = 0; i < 8; i += 1) {
    if (d.getUTCDay() === weekday && d > now) return d.toISOString();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(hourUtc, 0, 0, 0);
  }
  return d.toISOString();
}

function describeVisitEmailSchedule(prefs, now = new Date()) {
  if (!prefs || (!wantsEmailVisitInstant(prefs) && !wantsEmailVisitDigest(prefs))) {
    return {
      active: false,
      freq: prefs?.freq || null,
      summary: "Visit email is off. Choose Email or Both, turn Visits on, and Save.",
      nextAt: null,
    };
  }
  if (prefs.freq === "instant") {
    return {
      active: true,
      freq: "instant",
      summary: "Instant — email fires when a verified UF official visit is scheduled or cancelled.",
      nextAt: null,
    };
  }
  if (prefs.freq === "daily") {
    return {
      active: true,
      freq: "daily",
      summary: "Daily digest — about 10:00 a.m. Eastern when verified visits landed in the last day.",
      nextAt: nextDigestAtUtc(14, null, now),
    };
  }
  return {
    active: true,
    freq: "weekly",
    summary: "Weekly roundup — Mondays about 10:00 a.m. Eastern when verified visits landed that week.",
    nextAt: nextDigestAtUtc(14, 1, now),
  };
}

function maskEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1) return raw;
  const name = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const shown = name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`;
  return `${shown}@${domain}`;
}

async function listEligibleVisitInstantRecipients() {
  const rows = await persistence.loadAllPrefs();
  const byEmail = indexUsersByEmail(loadUsers());
  const out = [];
  for (const row of rows) {
    const prefs = normalizePrefs(row.prefs);
    if (!wantsEmailVisitInstant(prefs)) continue;
    const email = String(row.email || "")
      .trim()
      .toLowerCase();
    const user = email ? byEmail.get(email) || null : null;
    if (!hasSubscriberAccess(user)) continue;
    out.push({ email: row.email, prefs, user });
  }
  return out;
}

async function listEligibleVisitDigestRecipients({ freq = "weekly" } = {}) {
  const rows = await persistence.loadAllPrefs();
  const byEmail = indexUsersByEmail(loadUsers());
  const out = [];
  for (const row of rows) {
    const prefs = normalizePrefs(row.prefs);
    if (!wantsEmailVisitDigest(prefs)) continue;
    if (freq === "weekly" && prefs.freq !== "weekly") continue;
    if (freq === "daily" && prefs.freq !== "daily") continue;
    const email = String(row.email || "")
      .trim()
      .toLowerCase();
    const user = email ? byEmail.get(email) || null : null;
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
  getEmailAlertPrefs,
  describeVisitEmailSchedule,
  nextDigestAtUtc,
  maskEmail,
  listEligibleVisitDigestRecipients,
  listEligibleVisitInstantRecipients,
  requireAlertEmailSession,
  initAlertEmailPrefsStore,
};