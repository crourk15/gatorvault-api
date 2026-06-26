/**
 * Weekly verified UF OV recap email for subscribers (Email / Both + weekly roundup).
 */
const { isEmailJsReady, getEmailJsConfig } = require("./emailjs-config");
const { sendEmailViaEmailJS } = require("./emailjs-server");
const {
  listEligibleVisitDigestRecipients,
  filterRecapRowsForSubscriber,
} = require("./alert-email-prefs-service");

const SITE_URL = (process.env.SITE_URL || "https://gatorvaultinsider.com").replace(/\/$/, "");
const STATE_PATH = require("path").join(__dirname, "../data/ops/visit-intel-email-state.json");
const fs = require("fs");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { version: 1, digests: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(require("path").dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

function buildVisitRecapEmailHtml(recapRows, weekKey) {
  const items = recapRows
    .slice(0, 12)
    .map(
      (row) =>
        `<li><strong>${row.name}</strong> — ${row.visitStart}${row.visitEnd && row.visitEnd !== row.visitStart ? `–${row.visitEnd}` : ""} (${row.visitSourceLabel || "Verified"})</li>`
    )
    .join("");
  return [
    `<p>Your GatorVault verified UF official visit recap for <strong>${weekKey}</strong>:</p>`,
    `<ul>${items}</ul>`,
    `<p><a href="${SITE_URL}/vault/futurecast#visits">Open FutureCast Visit Intel →</a></p>`,
    `<p style="color:#666;font-size:12px;">Verified On3 / beat-confirmed OVs only — no rumor alerts.</p>`,
  ].join("");
}

async function sendSubscriberDigestEmail(to, subject, html) {
  if (!isEmailJsReady()) return { sent: false, reason: "email_not_configured" };
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
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
      tier_benefits: html,
      vault_url: `${SITE_URL}/vault/futurecast#visits`,
      support_email: process.env.EMAILJS_REPLY_TO || "gatorvaultinsider@gmail.com",
    },
  });
  return { sent: true };
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
  buildVisitRecapEmailHtml,
  sendVisitIntelWeeklyDigest,
};