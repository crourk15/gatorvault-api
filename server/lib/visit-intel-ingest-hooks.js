/**
 * C5 — On verified new OV ingest: alert side-effects + gated autoposter queue.
 */
const fs = require("fs");
const path = require("path");
const visitLogStore = require("./recruiting-visit-log-store");
const {
  getVerifiedFloridaVisitWindow,
  isVerifiedVisitLogSource,
  todayYmd,
} = require("./visit-intel-utils");

const STATE_PATH = path.join(__dirname, "../data/ops/visit-intel-ingest-alert-state.json");
const SITE_URL = (process.env.SITE_URL || "https://gatorvaultinsider.com").replace(/\/$/, "");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { version: 1, fingerprints: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  state.fingerprints = (state.fingerprints || []).slice(0, 500);
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

const { isOfficialVisitType } = require("./visit-intel-utils");

function isFloridaOfficialVisit(log) {
  if (!log?.playerSlug) return false;
  const school = String(log.school || "Florida").toLowerCase();
  if (!/florida|gators|\buf\b/.test(school)) return false;
  if (!isOfficialVisitType(log.visitType)) return false;
  return isVerifiedVisitLogSource(log.source, log);
}

function isUpcomingVisit(log, asOf = new Date()) {
  const window = getVerifiedFloridaVisitWindow(log);
  if (!window) return false;
  const today = todayYmd(asOf);
  return window.visitEnd >= today || window.visitStart >= today;
}

function buildUpcomingVisitPostText(log) {
  const name = log.playerName || log.playerSlug;
  return (
    `Fresh 2027 visit intel — ${name} has a verified UF official visit on the calendar.` +
    `\n\nFull tracker: ${SITE_URL}/vault/futurecast#visits`
  );
}

async function queueUpcomingVisitPost(log) {
  const text = buildUpcomingVisitPostText(log);
  if (process.env.X_AUTOPOST_ENABLED === "false") {
    return { queued: false, reason: "autoposter_disabled" };
  }

  const gate = require("./x-autoposter-visit-guard").evaluateVisitIntelPostGate({ text });
  if (!gate.allow) {
    return { queued: false, reason: gate.reason || "visit_guard", gate };
  }

  const policy = require("./x-autoposter-policy");
  const xStore = require("./x-autoposter-store");
  const fingerprint = log.fingerprint || `visit_upcoming|${log.playerSlug}|${log.date}`;

  const payload = {
    text,
    category: "news",
    topic: "recruiting",
    triggerType: "visit",
    source: "auto:visit-intel-ingest",
    intelFingerprint: fingerprint,
    intelType: "official_visit",
    playerName: log.playerName || null,
    playerSlug: log.playerSlug || null,
    scheduledAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    status: "pending",
    validationMeta: { situation: "visit", source: log.source || "on3" },
  };

  const check = policy.validatePostContent(payload);
  if (!check.valid) return { queued: false, reason: "policy", errors: check.errors };

  const out = xStore.enqueuePost(payload);
  return { queued: true, item: out.item, fingerprint };
}

async function handleNewVerifiedVisitLogs(logs = [], options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const queueX = options.queueX !== false;
  const state = readState();
  const seen = new Set(state.fingerprints || []);
  const results = [];

  for (const log of logs || []) {
    if (!isFloridaOfficialVisit(log)) {
      results.push({ slug: log?.playerSlug, skipped: true, reason: "not_verified_florida_ov" });
      continue;
    }
    if (!isUpcomingVisit(log, asOf)) {
      results.push({ slug: log.playerSlug, skipped: true, reason: "not_upcoming" });
      continue;
    }
    const fp = log.fingerprint;
    if (fp && seen.has(fp)) {
      results.push({ slug: log.playerSlug, skipped: true, reason: "already_alerted" });
      continue;
    }

    let queue = { queued: false, reason: dryRun ? "dry_run" : "skipped" };
    if (!dryRun && queueX) {
      queue = await queueUpcomingVisitPost(log);
    }

    let push = { sent: 0, skipped: true, reason: dryRun ? "dry_run" : "skipped" };
    if (!dryRun) {
      try {
        const { dispatchVisitScheduledPush } = require("./push-alert-service");
        push = await dispatchVisitScheduledPush(log);
      } catch (err) {
        push = { sent: 0, skipped: true, reason: err.message };
      }
    }

    let email = { sent: 0, skipped: true, reason: dryRun ? "dry_run" : "skipped" };
    if (!dryRun) {
      try {
        const { dispatchVisitScheduledEmail } = require("./visit-intel-email-digest");
        email = await dispatchVisitScheduledEmail(log);
      } catch (err) {
        email = { sent: 0, skipped: true, reason: err.message };
      }
    }

    if (!dryRun && fp && (queue.queued || (push.sent || 0) > 0 || (email.sent || 0) > 0)) {
      seen.add(fp);
    }

    results.push({
      slug: log.playerSlug,
      name: log.playerName,
      fingerprint: fp,
      queued: Boolean(queue.queued),
      queueReason: queue.reason || null,
      queueItemId: queue.item?.id || null,
      pushSent: push.sent || 0,
      pushSkipped: Boolean(push.skipped),
      pushReason: push.reason || null,
      emailSent: email.sent || 0,
      emailSkipped: Boolean(email.skipped),
      emailReason: email.reason || null,
    });
  }

  if (!dryRun) {
    state.fingerprints = [...seen];
    writeState(state);
  }

  const queued = results.filter((r) => r.queued).length;
  return { processed: results.length, queued, results };
}

module.exports = {
  handleNewVerifiedVisitLogs,
  isFloridaOfficialVisit,
  isUpcomingVisit,
  buildUpcomingVisitPostText,
};