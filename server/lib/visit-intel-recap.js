/**
 * C4 — Post-weekend verified OV recap (FutureCast + optional X queue).
 */
const fs = require("fs");
const path = require("path");
const visitLogStore = require("./recruiting-visit-log-store");
const {
  buildVerifiedVisitRecapRows,
  getVisitIntelBoardSnapshot,
  listRecentVerifiedFloridaOfficialVisits,
} = require("./visit-intel-utils");

const STATE_PATH = path.join(__dirname, "../data/ops/visit-intel-recap-state.json");
const TARGET_BOARD_PATH = path.join(__dirname, "../data/recruiting/2027-target-board.json");
const SITE_URL = (process.env.SITE_URL || "https://gatorvaultinsider.com").replace(/\/$/, "");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { version: 1, posts: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mondayYmdUtc(asOf = new Date()) {
  const d = new Date(asOf);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function loadPrioritySlugs() {
  try {
    const doc = JSON.parse(fs.readFileSync(TARGET_BOARD_PATH, "utf8"));
    return (doc.targets || []).map((t) => t.slug).filter(Boolean);
  } catch {
    return [];
  }
}

function buildWeekendRecapRows(asOfInput = new Date(), windowDays = 7) {
  const asOf = asOfInput instanceof Date ? asOfInput : new Date(asOfInput);
  const visitLogs = visitLogStore.loadDoc().items || [];
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const cutoffYmd = cutoff.toISOString().slice(0, 10);
  const mondayYmd = mondayYmdUtc(asOf);

  const completed = listRecentVerifiedFloridaOfficialVisits(visitLogs, {
    classYear: 2027,
    limit: 48,
    asOf,
  }).filter((row) => row.completed && row.visitEnd >= cutoffYmd);

  const prioritySlugs = loadPrioritySlugs();
  const recapRows = buildVerifiedVisitRecapRows([], visitLogs, asOf, {
    limit: 12,
    prioritySlugs,
    classYear: 2027,
  }).filter((row) => row.visitEnd >= mondayYmd || row.visitStart >= mondayYmd);

  return {
    visitLogs,
    completedSinceCutoff: completed,
    recapRows,
    boardSnapshot: getVisitIntelBoardSnapshot(visitLogs, asOf),
    weekKey: isoWeekKey(asOf),
    mondayYmd,
    cutoffYmd,
  };
}

function buildDailyDigestRows(asOfInput = new Date()) {
  const asOf = asOfInput instanceof Date ? asOfInput : new Date(asOfInput);
  const visitLogs = visitLogStore.loadDoc().items || [];
  const yesterday = new Date(asOf);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const sinceYmd = yesterday.toISOString().slice(0, 10);
  const dayKey = asOf.toISOString().slice(0, 10);
  const prioritySlugs = loadPrioritySlugs();
  const recapRows = buildVerifiedVisitRecapRows([], visitLogs, asOf, {
    limit: 12,
    prioritySlugs,
    classYear: 2027,
  }).filter((row) => row.visitEnd >= sinceYmd || row.visitStart >= dayKey);

  return {
    visitLogs,
    recapRows,
    boardSnapshot: getVisitIntelBoardSnapshot(visitLogs, asOf),
    dayKey,
    sinceYmd,
  };
}

async function runVisitIntelDailyDigest(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const built = buildDailyDigestRows(asOf);

  if (!built.recapRows.length) {
    return {
      ok: true,
      skipped: true,
      reason: "no_digest_rows",
      dayKey: built.dayKey,
      dryRun,
    };
  }

  const { sendVisitIntelDailyDigest } = require("./visit-intel-email-digest");
  const emailDigest = await sendVisitIntelDailyDigest({
    recapRows: built.recapRows,
    dayKey: built.dayKey,
    dryRun,
  });

  return {
    ok: true,
    dryRun,
    dayKey: built.dayKey,
    recapCount: built.recapRows.length,
    boardSnapshot: built.boardSnapshot,
    recapRows: built.recapRows,
    emailDigest,
  };
}

function buildRecapPostText(recapRows) {
  const n = recapRows.length;
  if (!n) return null;
  const names = recapRows
    .slice(0, 4)
    .map((r) => r.name)
    .filter(Boolean)
    .join(", ");
  const suffix = n > 4 ? ", …" : "";
  return (
    `Verified 2027 summer OV recap — GatorVault confirms ${n} completed official visit${n === 1 ? "" : "s"}` +
    `${names ? ` (${names}${suffix})` : ""}.\n\nFull tracker: ${SITE_URL}/vault/futurecast#visits`
  );
}

async function queueRecapPost(text, meta = {}) {
  if (!text) return { queued: false, reason: "empty_text" };
  if (process.env.X_AUTOPOST_ENABLED === "false") {
    return { queued: false, reason: "autoposter_disabled" };
  }

  const policy = require("./x-autoposter-policy");
  const xStore = require("./x-autoposter-store");
  const gate = require("./x-autoposter-visit-guard").evaluateVisitIntelPostGate({ text });
  if (!gate.allow) {
    return { queued: false, reason: gate.reason || "visit_guard", gate };
  }

  const fingerprint = `visit_recap_weekly|${meta.weekKey || isoWeekKey()}`;

  const payload = {
    text,
    category: "news",
    topic: "recruiting",
    triggerType: "visit_recap",
    source: "auto:visit-recap",
    intelFingerprint: fingerprint,
    intelType: "visit_recap",
    scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: "pending",
    validationMeta: { situation: "visit_recap", recapCount: meta.recapCount ?? null },
  };

  const check = policy.validatePostContent(payload);
  if (!check.valid) return { queued: false, reason: "policy", errors: check.errors };

  const out = xStore.enqueuePost(payload);
  return { queued: true, item: out.item, fingerprint };
}

async function maybeSendEmailDigest(result, built, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const sendEmail = options.sendEmail !== false;
  if (!sendEmail || !built.recapRows.length) return;
  try {
    const { sendVisitIntelWeeklyDigest } = require("./visit-intel-email-digest");
    result.emailDigest = await sendVisitIntelWeeklyDigest({
      recapRows: built.recapRows,
      weekKey: built.weekKey,
      dryRun,
    });
  } catch (err) {
    result.emailDigest = { ok: false, error: err.message };
  }
}

async function runVisitIntelRecap(options = {}) {
  const asOf = options.asOf ? new Date(options.asOf) : new Date();
  const dryRun = Boolean(options.dryRun);
  const queueX = options.queueX !== false;
  const windowDays = options.windowDays || 7;
  const built = buildWeekendRecapRows(asOf, windowDays);
  const text = buildRecapPostText(built.recapRows);
  const state = readState();
  const alreadyPosted = (state.posts || []).some((p) => p.weekKey === built.weekKey);

  const result = {
    ok: true,
    dryRun,
    weekKey: built.weekKey,
    recapCount: built.recapRows.length,
    completedSinceCutoff: built.completedSinceCutoff.length,
    boardSnapshot: built.boardSnapshot,
    recapRows: built.recapRows,
    postText: text,
    alreadyPosted,
    queued: false,
  };

  if (!text || built.recapRows.length === 0) {
    result.skipped = true;
    result.reason = "no_recap_rows";
    return result;
  }

  if (alreadyPosted) {
    result.skipped = true;
    result.reason = "already_posted_this_week";
    await maybeSendEmailDigest(result, built, options);
    return result;
  }

  if (dryRun || !queueX) {
    result.wouldQueue = Boolean(text);
    await maybeSendEmailDigest(result, built, options);
    return result;
  }

  const queue = await queueRecapPost(text, {
    weekKey: built.weekKey,
    recapCount: built.recapRows.length,
  });
  result.queue = queue;
  result.queued = Boolean(queue.queued);

  if (queue.queued) {
    state.posts = state.posts || [];
    state.posts.unshift({
      weekKey: built.weekKey,
      postedAt: new Date().toISOString(),
      recapCount: built.recapRows.length,
      queueItemId: queue.item?.id || null,
      fingerprint: queue.fingerprint,
    });
    state.posts = state.posts.slice(0, 52);
    writeState(state);

    const { clearFuturecastCacheSafe } = require("./recruiting-intel-cache");
    clearFuturecastCacheSafe();
  }

  await maybeSendEmailDigest(result, built, options);
  return result;
}

module.exports = {
  buildWeekendRecapRows,
  buildDailyDigestRows,
  buildRecapPostText,
  runVisitIntelRecap,
  runVisitIntelDailyDigest,
  isoWeekKey,
};