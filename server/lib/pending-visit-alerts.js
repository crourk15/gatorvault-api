/**
 * One-shot pending visit alerts — committed under data/ops, processed after API boot.
 * Dedupes via push dispatch fingerprints (Postgres) so redeploys do not re-spam.
 */
const fs = require("fs");
const path = require("path");

const PENDING_PATH = path.join(__dirname, "../data/ops/pending-visit-alerts.json");

function readPending() {
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));
  } catch {
    return { version: 1, items: [] };
  }
}

function writePending(doc) {
  fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(PENDING_PATH, JSON.stringify(doc, null, 2) + "\n");
}

function visitFingerprint(item) {
  if (item.fingerprint) return String(item.fingerprint);
  const slug = String(item.playerSlug || "").toLowerCase();
  const date = String(item.date || "").slice(0, 10);
  const type = String(item.visitType || "official_visit").toLowerCase();
  return `visit|${slug}|florida|${type}|${date}`;
}

async function ensureOperatorEmailPrefs(emails = []) {
  const { upsertEmailAlertPrefs } = require("./alert-email-prefs-service");
  const out = [];
  for (const email of emails) {
    const normalized = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalized) continue;
    try {
      const saved = await upsertEmailAlertPrefs(normalized, {
        method: "both",
        freq: "instant",
        visit: true,
        followPlayers: [],
      });
      out.push({ email: normalized, ok: true, saved: Boolean(saved) });
    } catch (err) {
      out.push({
        email: normalized,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

async function processPendingVisitAlerts(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const now = options.asOf ? new Date(options.asOf) : new Date();
  const doc = readPending();
  const items = Array.isArray(doc.items) ? doc.items : [];
  if (!items.length) return { ok: true, processed: 0, results: [] };

  try {
    const { initPushAlertStore } = require("./push-alert-service");
    await initPushAlertStore();
  } catch {
    /* optional */
  }

  const { alreadyDispatched } = require("./push-alert-service");
  const visitLogStore = require("./recruiting-visit-log-store");
  const store = require("./recruiting-store");
  const { handleNewVerifiedVisitLogs } = require("./visit-intel-ingest-hooks");
  const { isOfficialVisitType } = require("./visit-intel-utils");

  const operatorEmails = String(
    options.operatorEmails ||
      process.env.OPERATOR_ALERT_EMAILS ||
      "crourk15@gmail.com"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const emailPrefs = dryRun ? [] : await ensureOperatorEmailPrefs(operatorEmails);

  const results = [];
  let changed = false;

  for (const item of items) {
    if (!item || item.status === "done" || item.status === "skipped") {
      results.push({ id: item?.id, skipped: true, reason: item?.status || "empty" });
      continue;
    }

    const slug = String(item.playerSlug || "").toLowerCase();
    const visitType = String(item.visitType || "official_visit");
    const fingerprint = visitFingerprint(item);
    const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;

    if (dryRun) {
      results.push({
        id: item.id,
        dryRun: true,
        fingerprint,
        slug,
        expired: Boolean(expiresAt && now > expiresAt),
        alreadyDispatched: alreadyDispatched(fingerprint),
      });
      continue;
    }

    if (expiresAt && Number.isFinite(expiresAt.getTime()) && now > expiresAt) {
      item.status = "skipped";
      item.skipReason = "expired";
      changed = true;
      results.push({ id: item.id, skipped: true, reason: "expired" });
      continue;
    }

    if (!slug || !isOfficialVisitType(visitType)) {
      item.status = "skipped";
      item.skipReason = "invalid";
      changed = true;
      results.push({ id: item.id, skipped: true, reason: "invalid" });
      continue;
    }

    if (alreadyDispatched(fingerprint)) {
      item.status = "done";
      item.doneAt = now.toISOString();
      item.doneReason = "already_dispatched";
      changed = true;
      results.push({ id: item.id, skipped: true, reason: "already_dispatched", fingerprint });
      continue;
    }

    const reportedAt = new Date().toISOString();
    const logResult = await visitLogStore.appendVisitLog({
      playerSlug: slug,
      playerId: item.playerId || null,
      playerName: item.playerName || slug,
      school: item.school || "Florida",
      visitType,
      date: item.date || reportedAt.slice(0, 10),
      source: item.source || "manual",
      reportedAt,
      detail: item.detail || null,
      fingerprint,
      identityConfirmed: true,
    });

    try {
      await store.upsertPlayer({
        slug,
        name: item.playerName || slug,
        ufOvStatus: "scheduled",
        visitStart: String(item.date || "").slice(0, 10) || null,
        visitEnd: item.visitEnd ? String(item.visitEnd).slice(0, 10) : null,
        visits: [
          {
            school: "Florida",
            visitType,
            date: String(item.date || "").slice(0, 10) || null,
            source: item.source || "manual",
          },
        ],
      });
    } catch (err) {
      console.warn(
        "[pending-visit-alerts] player upsert failed:",
        err instanceof Error ? err.message : err
      );
    }

    const log = logResult?.item || {
      playerSlug: slug,
      playerName: item.playerName || slug,
      school: "Florida",
      visitType,
      date: item.date,
      source: item.source || "manual",
      fingerprint,
      identityConfirmed: true,
    };

    const fanout = await handleNewVerifiedVisitLogs([log], { queueX: item.queueX === true });
    const row = fanout?.results?.[0] || {};
    const sent =
      Number(row.pushSent || 0) > 0 || Number(row.emailSent || 0) > 0 || row.queued === true;

    item.status = sent || logResult?.created || logResult?.duplicate ? "done" : "failed";
    item.doneAt = now.toISOString();
    item.fanout = {
      pushSent: row.pushSent || 0,
      pushReason: row.pushReason || null,
      emailSent: row.emailSent || 0,
      emailReason: row.emailReason || null,
      queued: Boolean(row.queued),
    };
    changed = true;
    results.push({
      id: item.id,
      slug,
      fingerprint,
      created: Boolean(logResult?.created),
      duplicate: Boolean(logResult?.duplicate),
      ...item.fanout,
    });
  }

  if (changed && !dryRun) {
    try {
      writePending(doc);
    } catch (err) {
      console.warn(
        "[pending-visit-alerts] could not persist status:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    ok: true,
    processed: results.length,
    emailPrefs,
    results,
  };
}

module.exports = {
  PENDING_PATH,
  processPendingVisitAlerts,
  ensureOperatorEmailPrefs,
  visitFingerprint,
};
