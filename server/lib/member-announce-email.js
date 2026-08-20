/**
 * One-shot member announcements (e.g. App Store version live).
 */
'use strict';

const { emailShell, ctaButton, displayNameFrom } = require('./onboarding-emails');
const { hasPaidAccess, trialState } = require('./subscription-service');
const {
  mapPool,
  announceEmailConcurrency,
  announceSaveEvery,
} = require('./fanout-util');

const SITE_URL = String(process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
const APP_STORE_URL =
  process.env.GV_APP_STORE_URL ||
  'https://apps.apple.com/app/gatorvault-insider/id6783848215';
const SUPPORT_EMAIL = process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com';

const DEFAULT_VERSION = '1.0.15';

/** Hard skip — test / App Review / Charles operator accounts. */
function shouldSkipMemberAnnounceRecipient(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const name = String(user?.name || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { skip: true, reason: 'no_email' };

  if (/appreview|app.?review|apple.?review/.test(email)) {
    return { skip: true, reason: 'app_review' };
  }
  if (/\+test@|^test@|@test\.|test\+/.test(email) || /\btest\b/.test(email.split('@')[0] || '')) {
    return { skip: true, reason: 'test_email' };
  }
  if (email.includes('crourk') || email.includes('charles') || email.includes('rourk')) {
    return { skip: true, reason: 'operator_name_email' };
  }
  if (/\bcharles\b|\brourk\b|\bcrourk\b/.test(name)) {
    return { skip: true, reason: 'operator_name' };
  }
  if (email === 'gatorvaultinsider@gmail.com' || email.endsWith('@gatorvaultinsider.com')) {
    return { skip: true, reason: 'operator_domain' };
  }
  if (user.fanDigestOptOut === true || user.announceOptOut === true) {
    return { skip: true, reason: 'opt_out' };
  }
  return { skip: false };
}

function hasSubscriberAccess(user) {
  if (hasPaidAccess(user)) return true;
  return !trialState(user).expired;
}

function listAnnounceRecipients(loadUsers, { requireActiveAccess = true } = {}) {
  const users = typeof loadUsers === 'function' ? loadUsers() || [] : [];
  const kept = [];
  const skipped = [];
  for (const user of users) {
    const gate = shouldSkipMemberAnnounceRecipient(user);
    if (gate.skip) {
      skipped.push({ email: user.email || null, reason: gate.reason });
      continue;
    }
    if (requireActiveAccess && !hasSubscriberAccess(user)) {
      skipped.push({ email: user.email, reason: 'inactive' });
      continue;
    }
    kept.push(user);
  }
  return { recipients: kept, skipped };
}

function buildIosUpdateBodyHtml({ name, email, version = DEFAULT_VERSION } = {}) {
  const displayName = displayNameFrom({ name, email });
  const ver = String(version || DEFAULT_VERSION);
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">GatorVault Insider <strong>${ver}</strong> is live on the App Store.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Update now so you get the latest recruiting board, FutureCast, visit alerts, and Film Room polish on your iPhone.</p>
  ${ctaButton(APP_STORE_URL, 'Update on the App Store')}
  <p style="margin:20px 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Already installed?</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Open the App Store → search <strong>GatorVault Insider</strong> → tap <strong>Update</strong>. Or open this link on your iPhone:</p>
  <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;line-height:1.55;word-break:break-all;">${APP_STORE_URL}</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Same login as the web vault. Alerts and membership carry over.</p>
  <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.55;">— GatorVault</p>
  <p style="margin:12px 0 0;font-size:12px;color:#475569;line-height:1.55;">Questions? Reply or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a>.</p>
`;
}

function getIosUpdateAnnounceEmail(opts = {}) {
  const version = String(opts.version || DEFAULT_VERSION);
  const subject = opts.subject || `GatorVault Insider ${version} is live on the App Store`;
  const bodyInner = buildIosUpdateBodyHtml(opts);
  const html = emailShell(bodyInner);
  return {
    kind: 'ios_app_store_update',
    version,
    subject,
    html,
    templateParams: {
      name: displayNameFrom(opts),
      email: opts.email || '',
      body_html: bodyInner,
      email_subject: subject,
      vault_url: SITE_URL + '/vault/',
      support_email: SUPPORT_EMAIL,
    },
  };
}

/**
 * Send App Store update email to eligible members.
 * Stamps are persisted incrementally (updateUser or periodic saveUsers) so a mid-run
 * crash does not re-blast already-sent members on retry.
 */
async function sendIosUpdateAnnounce({
  loadUsers,
  deliverEmail,
  updateUser = null,
  saveUsers = null,
  version = DEFAULT_VERSION,
  dryRun = false,
  force = false,
  requireActiveAccess = true,
  limit = null,
  concurrency = announceEmailConcurrency(),
  saveEvery = announceSaveEvery(),
} = {}) {
  if (typeof loadUsers !== 'function' || typeof deliverEmail !== 'function') {
    throw new Error('sendIosUpdateAnnounce requires loadUsers and deliverEmail');
  }

  const { recipients, skipped } = listAnnounceRecipients(loadUsers, { requireActiveAccess });
  const queue = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? recipients.slice(0, Number(limit))
    : recipients;

  const details = [];
  let sent = 0;
  let failed = 0;
  let sinceSave = 0;
  const stampKey = `iosAnnounce_${String(version).replace(/[^0-9.]/g, '_')}`;

  /** Serialize stamp writes when sends run concurrently. */
  let stampChain = Promise.resolve();
  function enqueueStamp(work) {
    const run = stampChain.then(work);
    stampChain = run.catch(() => {});
    return run;
  }

  async function persistStamp(user) {
    const iso = new Date().toISOString();
    user[stampKey] = iso;
    if (typeof updateUser === 'function') {
      await enqueueStamp(async () => {
        updateUser(user.email, { [stampKey]: iso });
      });
      return;
    }
    sinceSave += 1;
    if (typeof saveUsers === 'function' && sinceSave >= saveEvery) {
      await enqueueStamp(async () => {
        saveUsers(loadUsers());
        sinceSave = 0;
      });
    }
  }

  await mapPool(queue, dryRun ? 1 : concurrency, async (user) => {
    if (!force && user[stampKey]) {
      details.push({ email: user.email, sent: false, reason: 'already_sent' });
      return;
    }

    const built = getIosUpdateAnnounceEmail({
      email: user.email,
      name: user.name,
      version,
    });

    if (dryRun) {
      details.push({ email: user.email, sent: false, dryRun: true, subject: built.subject });
      return;
    }

    try {
      const delivery = await deliverEmail(user.email, built.subject, built.html, {
        name: built.templateParams.name,
        bodyHtml: built.templateParams.body_html,
        emailSubject: built.subject,
        html: built.html,
      });
      sent += 1;
      details.push({
        email: user.email,
        sent: true,
        provider: delivery?.provider || null,
        id: delivery?.id || null,
      });
      await persistStamp(user);
    } catch (err) {
      failed += 1;
      details.push({
        email: user.email,
        sent: false,
        reason: 'send_failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  await stampChain;

  if (
    !dryRun &&
    sent > 0 &&
    typeof updateUser !== 'function' &&
    typeof saveUsers === 'function' &&
    sinceSave > 0
  ) {
    saveUsers(loadUsers());
  }

  return {
    ok: failed === 0,
    version,
    dryRun,
    candidateCount: recipients.length,
    queued: queue.length,
    sent,
    failed,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 50),
    details,
    concurrency: dryRun ? 1 : concurrency,
  };
}

module.exports = {
  DEFAULT_VERSION,
  APP_STORE_URL,
  shouldSkipMemberAnnounceRecipient,
  listAnnounceRecipients,
  buildIosUpdateBodyHtml,
  getIosUpdateAnnounceEmail,
  sendIosUpdateAnnounce,
};
