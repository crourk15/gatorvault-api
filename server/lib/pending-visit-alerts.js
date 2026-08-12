/**
 * One-shot pending visit alerts — committed under data/ops, processed after API boot.
 * Force-delivers to OPERATOR_ALERT_EMAILS so owner QA is not blocked by empty prefs/devices.
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

function operatorEmailsFrom(options = {}) {
  return String(
    options.operatorEmails ||
      process.env.OPERATOR_ALERT_EMAILS ||
      "crourk15@gmail.com"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureOperatorEmailPrefs(emails = []) {
  const { upsertEmailAlertPrefs } = require("./alert-email-prefs-service");
  const out = [];
  for (const email of emails) {
    const normalized = String(email || "").trim().toLowerCase();
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

/** Bypass subscriber lists — always try owner inboxes/devices. */
async function forceDeliverToOperators(log, emails = []) {
  const {
    sendSubscriberDigestEmail,
    buildVisitScheduledEmailHtml,
  } = require("./visit-intel-email-digest");
  const { dispatchVisitPushToEmail } = require("./push-alert-service");
  const name = log.playerName || log.playerSlug;
  const subject = `Verified UF OV scheduled — ${name}`;
  const html = buildVisitScheduledEmailHtml(log);
  const results = [];

  for (const email of emails) {
    let emailOut = { sent: false, reason: "skipped" };
    try {
      emailOut = await sendSubscriberDigestEmail(email, subject, html);
    } catch (err) {
      emailOut = {
        sent: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    let pushOut = { ok: false, reason: "skipped" };
    try {
      pushOut = await dispatchVisitPushToEmail(email, log, {
        fingerprint: `force|${log.fingerprint || visitFingerprint(log)}|${email}`,
        force: true,
      });
    } catch (err) {
      pushOut = {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    results.push({
      email,
      emailSent: Boolean(emailOut.sent),
      emailReason: emailOut.reason || null,
      pushSent: Number(pushOut.sent || 0),
      pushOk: Boolean(pushOut.ok),
      pushReason: pushOut.reason || pushOut.error || null,
    });
  }

  return results;
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

  const operatorEmails = operatorEmailsFrom(options);
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
        operatorEmails,
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

    // Broadcast to all eligible members (may be zero).
    const fanout = await handleNewVerifiedVisitLogs([log], {
      queueX: item.queueX === true,
    });
    const row = fanout?.results?.[0] || {};

    // Always force-deliver to operator inboxes/devices (owner QA).
    const operatorDelivery = await forceDeliverToOperators(log, operatorEmails);
    const operatorEmailSent = operatorDelivery.some((r) => r.emailSent);
    const operatorPushSent = operatorDelivery.some((r) => r.pushSent > 0);
    const broadcastSent =
      Number(row.pushSent || 0) > 0 || Number(row.emailSent || 0) > 0;

    item.status = operatorEmailSent || operatorPushSent || broadcastSent ? "done" : "failed";
    item.doneAt = now.toISOString();
    item.fanout = {
      pushSent: row.pushSent || 0,
      pushReason: row.pushReason || null,
      emailSent: row.emailSent || 0,
      emailReason: row.emailReason || null,
      queued: Boolean(row.queued),
      operatorDelivery,
    };
    changed = true;
    results.push({
      id: item.id,
      slug,
      fingerprint,
      created: Boolean(logResult?.created),
      duplicate: Boolean(logResult?.duplicate),
      ...item.fanout,
      delivered: item.status === "done",
    });

    console.log(
      "[pending-visit-alerts] item",
      item.id,
      "status",
      item.status,
      "operator",
      JSON.stringify(operatorDelivery)
    );
  }

  if (changed) {
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
  forceDeliverToOperators,
  visitFingerprint,
  operatorEmailsFrom,
};
