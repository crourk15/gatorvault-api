/**
 * Verified UF OV email alerts — instant scheduled/cancelled + weekly recap digest.
 */
const { isEmailJsReady, getEmailJsConfig } = require("./emailjs-config");
const { sendEmailViaEmailJS } = require("./emailjs-server");
const {
  listEligibleVisitDigestRecipients,
  listEligibleVisitInstantRecipients,
  filterRecapRowsForSubscriber,
} = require("./alert-email-prefs-service");
const { subscriberMatchesPayload } = require("./push-alert-filters");
const { getVerifiedFloridaVisitWindow } = require("./visit-intel-utils");

const SITE_URL = (process.env.SITE_URL || "https://gatorvaultinsider.com").replace(/\/$/, "");
const STATE_PATH = require("path").join(__dirname, "../data/ops/visit-intel-email-state.json");
const fs = require("fs");

function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return { version: 1, digests: [], dailyDigests: [], instant: [], ...state };
  } catch {
    return { version: 1, digests: [], dailyDigests: [], instant: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(require("path").dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

function formatDigestRecapItem(row) {
  const dates = `${row.visitStart}${row.visitEnd && row.visitEnd !== row.visitStart ? `–${row.visitEnd}` : ""}`;
  const base = `<strong>${row.name}</strong> — ${dates} (${row.visitSourceLabel || "Verified"})`;
  if (row.movementNarrative) {
    return `<li>${base}<br/><span style="color:#1a5c1a;font-size:13px;">${row.movementNarrative}</span></li>`;
  }
  return `<li>${base}</li>`;
}

function buildVisitRecapEmailHtml(recapRows, weekKey) {
  const items = recapRows.slice(0, 12).map(formatDigestRecapItem).join("");
  return [
    `<p>Your GatorVault verified UF official visit recap for <strong>${weekKey}</strong>:</p>`,
    `<ul>${items}</ul>`,
    `<p><a href="${SITE_URL}/vault/futurecast#visits">Open FutureCast Visit Intel →</a></p>`,
    `<p style="color:#666;font-size:12px;">Verified On3 / beat-confirmed OVs only — no rumor alerts.</p>`,
  ].join("");
}

function buildVisitDailyEmailHtml(recapRows, dayKey) {
  const items = recapRows.slice(0, 12).map(formatDigestRecapItem).join("");
  return [
    `<p>Your GatorVault verified UF visit intel digest for <strong>${dayKey}</strong>:</p>`,
    `<ul>${items}</ul>`,
    `<p><a href="${SITE_URL}/vault/futurecast#visits">Open FutureCast Visit Intel →</a></p>`,
    `<p style="color:#666;font-size:12px;">Verified On3 / beat-confirmed OVs only — no rumor alerts.</p>`,
  ].join("");
}

function visitAlertPlayerUrl(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return `${SITE_URL}/vault/alerts/`;
  return `${SITE_URL}/vault/recruiting/player/${encodeURIComponent(normalized)}/`;
}

async function sendSubscriberDigestEmail(to, subject, html, options = {}) {
  if (!isEmailJsReady()) return { sent: false, reason: "email_not_configured" };
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
  const vaultUrl =
    options.vaultUrl ||
    (options.playerSlug ? visitAlertPlayerUrl(options.playerSlug) : `${SITE_URL}/vault/futurecast#visits`);
  await sendEmailViaEmailJS({
    serviceId,
    templateId,
    publicKey,
    privateKey,
    templateParams: {
      to_email: to,
      email: to,
      name: to.split("@")[0],
      email_subject: subject,
      body_html: html,
      tier_benefits: html,
      vault_url: vaultUrl,
      support_email: process.env.EMAILJS_REPLY_TO || "gatorvaultinsider@gmail.com",
    },
  });
  return { sent: true };
}

function formatVisitWindow(log) {
  const window = getVerifiedFloridaVisitWindow(log);
  if (!window) return log?.date || null;
  if (window.visitStart === window.visitEnd) return window.visitStart;
  return `${window.visitStart}–${window.visitEnd}`;
}

function buildVisitInstantEmailHtml({ headline, detail, playerSlug, ctaLabel, ctaUrl }) {
  const href = ctaUrl || (playerSlug ? visitAlertPlayerUrl(playerSlug) : `${SITE_URL}/vault/futurecast#visits`);
  const label = ctaLabel || (playerSlug ? "Open player profile →" : "Open FutureCast Visit Intel →");
  return [
    `<p>${headline}</p>`,
    detail ? `<p>${detail}</p>` : "",
    `<p><a href="${href}">${label}</a></p>`,
    `<p style="color:#666;font-size:12px;">GatorVault verified On3 / beat-confirmed visit intel only.</p>`,
  ]
    .filter(Boolean)
    .join("");
}

function buildVisitScheduledEmailHtml(log) {
  const name = log.playerName || log.playerSlug;
  const when = formatVisitWindow(log);
  return buildVisitInstantEmailHtml({
    headline: `<strong>${name}</strong> has a verified UF official visit on the calendar.`,
    detail: when ? `Visit window: ${when}.` : null,
    playerSlug: log.playerSlug,
  });
}

function buildVisitCancelledEmailHtml(row) {
  const name = row.playerName || row.playerSlug;
  const next = row.nextVisitSchool ? ` · now visiting ${row.nextVisitSchool}` : "";
  return buildVisitInstantEmailHtml({
    headline: `<strong>${name}</strong> cancelled his official visit to Florida${next}.`,
    detail: "We will update the player profile as new verified visit intel is confirmed.",
    playerSlug: row.playerSlug,
  });
}

function instantFingerprintAlreadySent(fingerprint) {
  if (!fingerprint) return false;
  const state = readState();
  return (state.instant || []).includes(fingerprint);
}

function markInstantFingerprintSent(fingerprint) {
  if (!fingerprint) return;
  const state = readState();
  state.instant = [fingerprint, ...(state.instant || [])].slice(0, 500);
  writeState(state);
}

async function dispatchVisitInstantEmail(payload, options = {}) {
  const fingerprint = payload?.fingerprint || payload?.tag;
  if (!fingerprint) return { ok: false, skipped: true, reason: "missing_fingerprint" };

  if (options.dryRun) {
    const recipients = await listEligibleVisitInstantRecipients();
    const filtered = recipients.filter((recipient) =>
      subscriberMatchesPayload({ prefs: recipient.prefs }, payload)
    );
    return { ok: true, dryRun: true, fingerprint, wouldSend: filtered.length };
  }

  if (instantFingerprintAlreadySent(fingerprint)) {
    return { ok: true, skipped: true, reason: "already_dispatched", fingerprint };
  }

  if (!isEmailJsReady()) {
    return { ok: false, skipped: true, reason: "email_not_configured", fingerprint };
  }

  const recipients = await listEligibleVisitInstantRecipients();
  const filtered = recipients.filter((recipient) =>
    subscriberMatchesPayload({ prefs: recipient.prefs }, payload)
  );

  if (!filtered.length) {
    return { ok: true, skipped: true, reason: "no_instant_subscribers", fingerprint };
  }

  let sent = 0;
  const errors = [];
  for (const recipient of filtered) {
    try {
      const out = await sendSubscriberDigestEmail(recipient.email, payload.subject, payload.html, {
        playerSlug: payload.playerSlug,
        vaultUrl: payload.playerSlug ? visitAlertPlayerUrl(payload.playerSlug) : undefined,
      });
      if (out.sent) sent += 1;
    } catch (err) {
      errors.push({ email: recipient.email, error: err.message });
    }
  }

  if (sent > 0) markInstantFingerprintSent(fingerprint);

  return {
    ok: true,
    fingerprint,
    recipients: filtered.length,
    sent,
    errors,
  };
}

async function dispatchVisitScheduledEmail(log, options = {}) {
  if (!log?.playerSlug) return { ok: false, skipped: true, reason: "invalid_log" };
  const name = log.playerName || log.playerSlug;
  const fingerprint = log.fingerprint || `visit_scheduled|${log.playerSlug}|${log.date}`;
  return dispatchVisitInstantEmail(
    {
      subject: `Verified UF OV scheduled — ${name}`,
      html: buildVisitScheduledEmailHtml(log),
      fingerprint,
      tag: fingerprint,
      type: "visit_scheduled",
      playerSlug: log.playerSlug,
      playerName: name,
    },
    options
  );
}

async function dispatchVisitCancelledEmail(row, options = {}) {
  if (!row?.playerSlug) return { ok: false, skipped: true, reason: "invalid_row" };
  if (row.identityConfirmed === false) return { ok: false, skipped: true, reason: "unverified" };
  const name = row.playerName || row.playerSlug;
  const fingerprint = row.fingerprint || `visit_cancelled|${row.playerSlug}`;
  return dispatchVisitInstantEmail(
    {
      subject: `Verified UF OV cancelled — ${name}`,
      html: buildVisitCancelledEmailHtml(row),
      fingerprint,
      tag: fingerprint,
      type: "visit_cancelled",
      playerSlug: row.playerSlug,
      playerName: name,
    },
    options
  );
}

async function sendVisitIntelDailyDigest({ recapRows, dayKey, dryRun = false }) {
  if (!Array.isArray(recapRows) || !recapRows.length || !dayKey) {
    return { ok: true, skipped: true, reason: "no_recap_rows" };
  }

  const state = readState();
  const alreadySent = (state.dailyDigests || []).some((d) => d.dayKey === dayKey);
  if (alreadySent) {
    return { ok: true, skipped: true, reason: "already_sent_today", dayKey };
  }

  const recipients = await listEligibleVisitDigestRecipients({ freq: "daily" });
  if (!recipients.length) {
    return dryRun
      ? { ok: true, dryRun: true, dayKey, wouldSend: 0, recipients: 0 }
      : { ok: true, skipped: true, reason: "no_email_subscribers", dayKey };
  }

  let sent = 0;
  let skippedEmpty = 0;
  const errors = [];

  for (const recipient of recipients) {
    const rows = filterRecapRowsForSubscriber(recapRows, recipient.prefs);
    if (!rows.length) {
      skippedEmpty += 1;
      continue;
    }
    const subject = `GatorVault verified visit intel — ${dayKey}`;
    const html = buildVisitDailyEmailHtml(rows, dayKey);
    if (dryRun) {
      sent += 1;
      continue;
    }
    try {
      const out = await sendSubscriberDigestEmail(recipient.email, subject, html);
      if (out.sent) sent += 1;
    } catch (err) {
      errors.push({ email: recipient.email, error: err.message });
    }
  }

  if (!dryRun && sent > 0) {
    state.dailyDigests = state.dailyDigests || [];
    state.dailyDigests.unshift({
      dayKey,
      sentAt: new Date().toISOString(),
      sent,
      skippedEmpty,
      errors: errors.length,
    });
    state.dailyDigests = state.dailyDigests.slice(0, 90);
    writeState(state);
  }

  return {
    ok: true,
    dayKey,
    dryRun,
    recipients: recipients.length,
    sent,
    skippedEmpty,
    errors,
  };
}

async function sendVisitIntelWeeklyDigest({ recapRows, weekKey, dryRun = false }) {
  if (!Array.isArray(recapRows) || !recapRows.length || !weekKey) {
    return { ok: true, skipped: true, reason: "no_recap_rows" };
  }

  const state = readState();
  const alreadySent = (state.digests || []).some((d) => d.weekKey === weekKey);
  if (alreadySent) {
    return { ok: true, skipped: true, reason: "already_sent_this_week", weekKey };
  }

  const recipients = await listEligibleVisitDigestRecipients({ freq: "weekly" });
  if (!recipients.length) {
    return { ok: true, skipped: true, reason: "no_email_subscribers", weekKey };
  }

  let sent = 0;
  let skippedEmpty = 0;
  const errors = [];

  for (const recipient of recipients) {
    const rows = filterRecapRowsForSubscriber(recapRows, recipient.prefs);
    if (!rows.length) {
      skippedEmpty += 1;
      continue;
    }
    const subject = `GatorVault verified OV recap — ${weekKey}`;
    const html = buildVisitRecapEmailHtml(rows, weekKey);
    if (dryRun) {
      sent += 1;
      continue;
    }
    try {
      const out = await sendSubscriberDigestEmail(recipient.email, subject, html);
      if (out.sent) sent += 1;
    } catch (err) {
      errors.push({ email: recipient.email, error: err.message });
    }
  }

  if (!dryRun && sent > 0) {
    state.digests = state.digests || [];
    state.digests.unshift({ weekKey, sentAt: new Date().toISOString(), sent, skippedEmpty, errors: errors.length });
    state.digests = state.digests.slice(0, 52);
    writeState(state);
  }

  return {
    ok: true,
    weekKey,
    dryRun,
    recipients: recipients.length,
    sent,
    skippedEmpty,
    errors,
  };
}

module.exports = {
  formatDigestRecapItem,
  buildVisitRecapEmailHtml,
  buildVisitDailyEmailHtml,
  buildVisitScheduledEmailHtml,
  buildVisitCancelledEmailHtml,
  sendVisitIntelWeeklyDigest,
  sendVisitIntelDailyDigest,
  dispatchVisitScheduledEmail,
  dispatchVisitCancelledEmail,
};