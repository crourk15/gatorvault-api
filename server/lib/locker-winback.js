/**
 * Expired locker courtesy: add N days to trialEnd and email a come-back note.
 * Does not grant paid / manual subscription.
 */
'use strict';

const { findUserByEmail, updateUser } = require('./user-store');
const { hasPaidAccess, trialState } = require('./subscription-service');
const { extendTrial } = require('./trial-ledger');
const {
  emailShell,
  ctaButton,
  displayNameFrom,
  VAULT_URL,
  VAULT_LINK_LABEL,
  VAULT_URL_DISPLAY,
} = require('./onboarding-emails');

const SUPPORT_EMAIL = process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com';
const DEFAULT_DAYS = 30;
const STAMP_KEY = 'lockerWinbackAt';
const EMAIL_STAMP_KEY = 'lockerWinbackEmailedAt';

const SEP_2026_EXPIRED_LOCKER = [
  { name: 'Michael Keener', email: 'mekeener50@gmail.com' },
  { name: 'Michael Brown', email: 'floridagators2027@icloud.com' },
  { name: 'Bob Eugene', email: 'rickbaker250@gmail.com' },
  { name: 'Michael', email: 'michaeljj6984@icloud.com' },
  { name: 'L.D. Edwards, Sr', email: 'l.d.edwards@me.com' },
  { name: 'Phillip Morgan', email: 'philm5150@yahoo.com' },
  { name: 'Michael Singer', email: 'mike.singer24@yahoo.com' },
  { name: 'Kyriacos Davis', email: 'kyriacos.davis@gmail.com' },
  { name: 'Chris Vinson', email: 'cvinsonsc@gmail.com' },
  { name: 'Anthony carnaggie', email: 'anthonycarnaggie@gmail.com' },
  { name: 'Paul Preedom', email: 'mossyheadedgator@outlook.com' },
  { name: 'Edwin Durden', email: 'bud731@gmail.com' },
  { name: 'AB', email: 'aaronbrown147@gmail.com' },
  { name: 'Travis Alley', email: 'travis_alley@icloud.com' },
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function clampDays(days) {
  return Math.min(Math.max(parseInt(String(days), 10) || DEFAULT_DAYS, 1), 90);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function greetingName(user) {
  const name = String(user?.name || '').trim();
  if (name) {
    const first = name.split(/\s+/)[0].replace(/,$/, '');
    if (first.length >= 2) return first;
  }
  return displayNameFrom(user);
}

function shouldSkipWinbackEmail(email) {
  const e = normalizeEmail(email);
  if (!e || !e.includes('@')) return { skip: true, reason: 'no_email' };
  if (e.endsWith('@gatorvault.test') || e.endsWith('@gatorvaultinsider.com')) {
    return { skip: true, reason: 'test_or_operator' };
  }
  if (e === 'testeraccount@gamil.com' || e === 'testeraccount@gmail.com') {
    return { skip: true, reason: 'test_email' };
  }
  if (/appreview|app.?review|apple.?review/.test(e)) {
    return { skip: true, reason: 'app_review' };
  }
  const local = e.split('@')[0] || '';
  if (
    local.startsWith('tester') ||
    local.includes('teaser.look') ||
    /\btest\b/.test(local) ||
    local.includes('+test')
  ) {
    return { skip: true, reason: 'test_email' };
  }
  return { skip: false };
}

function formatTrialEnd(iso) {
  const end = iso ? new Date(iso) : null;
  if (!end || !Number.isFinite(end.getTime())) return null;
  return end.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildLockerWinbackBodyHtml({ name, email, trialEndStr, days = DEFAULT_DAYS } = {}) {
  const displayName = escapeHtml(greetingName({ name, email }));
  const safeEmail = escapeHtml(normalizeEmail(email));
  const n = clampDays(days);
  const when = trialEndStr
    ? `Your locker is open through <strong>${escapeHtml(trialEndStr)}</strong>.`
    : `Your locker is open for another <strong>${n} days</strong>.`;
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your GatorVault trial ran out — and we just put another <strong>${n} days</strong> back on your account. Come back in. This extra month is on us.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">The vault is in a better place than when you first signed up. Recruiting and FutureCast are sharper, Film Room is this year's staff tape, Game Week is live, and the iPhone app is cleaner. We want you to enjoy it.</p>
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your locker is open</p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">${when} Same email. No card required.</p>
  ${ctaButton(VAULT_URL, VAULT_LINK_LABEL)}
  <p style="margin:0 0 14px;font-size:13px;color:#94a3b8;line-height:1.55;">${VAULT_URL_DISPLAY}</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">Sign in with <strong>${safeEmail}</strong>. On iPhone, open <strong>GatorVault Insider</strong> and use that same login.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Enjoy the next ${n} days — then keep it if it's your kind of Gator board.</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault</p>
  <p style="margin:12px 0 0;font-size:12px;color:#475569;line-height:1.55;">Questions? Reply or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a>.</p>
`;
}

function getLockerWinbackEmail(opts = {}) {
  const days = clampDays(opts.days);
  const subject =
    opts.subject ||
    'Your GatorVault locker is open again — 30 more days on us';
  const bodyInner = buildLockerWinbackBodyHtml(opts);
  return {
    kind: 'locker_winback',
    subject,
    html: emailShell(bodyInner),
    templateParams: {
      name: greetingName(opts),
      email: normalizeEmail(opts.email),
      body_html: bodyInner,
      email_subject: subject,
      vault_url: VAULT_URL,
      support_email: SUPPORT_EMAIL,
    },
    days,
  };
}

function parseEmailList(raw) {
  if (Array.isArray(raw)) {
    return raw.map(normalizeEmail).filter(Boolean);
  }
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

async function extendOneExpiredLocker({
  email,
  days = DEFAULT_DAYS,
  sendEmail = true,
  dryRun = false,
  force = false,
  now = new Date(),
  deliverEmail = null,
} = {}) {
  const normalized = normalizeEmail(email);
  const skip = shouldSkipWinbackEmail(normalized);
  if (skip.skip) {
    return { email: normalized, ok: false, skipped: true, reason: skip.reason };
  }

  const user = findUserByEmail(normalized);
  if (!user) {
    return { email: normalized, ok: false, skipped: true, reason: 'account_not_found' };
  }
  if (hasPaidAccess(user)) {
    return { email: normalized, ok: false, skipped: true, reason: 'paid' };
  }

  const trial = trialState(user);
  if (user[STAMP_KEY] && !force) {
    return {
      email: normalized,
      ok: false,
      skipped: true,
      reason: 'already_extended',
      trialEnd: trial.trialEndISO,
      lockerWinbackAt: user[STAMP_KEY],
    };
  }
  if (!trial.expired && !force) {
    return {
      email: normalized,
      ok: false,
      skipped: true,
      reason: 'still_active',
      trialEnd: trial.trialEndISO,
    };
  }

  const n = clampDays(days);
  if (dryRun) {
    return {
      email: normalized,
      ok: true,
      dryRun: true,
      name: user.name || null,
      days: n,
      previousTrialEnd: trial.trialEndISO,
      wouldEmail: sendEmail !== false,
    };
  }

  const ledger = extendTrial(normalized, { days: n, now });
  const trialEnd = ledger?.trialEnd || new Date(now.getTime() + n * 86400000).toISOString();
  const iso = now.toISOString();
  const patch = {
    trialEnd,
    trialRemindersSent: [],
    trialExtendedAt: iso,
    trialExtensionDays: n,
    trialExtensionReason: 'expired_locker_winback',
    [STAMP_KEY]: iso,
    lockerWinbackDays: n,
  };
  updateUser(normalized, patch);

  let emailResult = { sent: false, skipped: sendEmail === false };
  if (sendEmail !== false) {
    if (typeof deliverEmail !== 'function') {
      emailResult = { sent: false, reason: 'no_deliver_email' };
    } else if (user[EMAIL_STAMP_KEY] && !force) {
      emailResult = { sent: false, skipped: true, reason: 'already_emailed' };
    } else {
      const built = getLockerWinbackEmail({
        email: normalized,
        name: user.name,
        trialEndStr: formatTrialEnd(trialEnd),
        days: n,
      });
      try {
        const delivery = await deliverEmail(normalized, built.subject, built.html, {
          name: built.templateParams.name,
          bodyHtml: built.templateParams.body_html,
          emailSubject: built.subject,
          html: built.html,
        });
        const sent = delivery?.sent !== false;
        emailResult = {
          sent,
          provider: delivery?.provider || null,
          id: delivery?.id || null,
          error: sent ? null : delivery?.error || null,
        };
        if (sent) {
          updateUser(normalized, { [EMAIL_STAMP_KEY]: new Date().toISOString() });
        }
      } catch (err) {
        emailResult = {
          sent: false,
          reason: 'send_failed',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  return {
    email: normalized,
    ok: true,
    name: user.name || null,
    days: n,
    previousTrialEnd: trial.trialEndISO,
    trialEnd,
    emailed: Boolean(emailResult.sent),
    delivery: emailResult,
  };
}

async function runLockerWinback({
  emails = [],
  days = DEFAULT_DAYS,
  sendEmail = true,
  dryRun = false,
  force = false,
  now = new Date(),
  deliverEmail = null,
} = {}) {
  const list = parseEmailList(emails);
  const details = [];
  let extended = 0;
  let emailed = 0;
  let skipped = 0;
  let failed = 0;

  for (const email of list) {
    const row = await extendOneExpiredLocker({
      email,
      days,
      sendEmail,
      dryRun,
      force,
      now,
      deliverEmail,
    });
    details.push(row);
    if (row.skipped) skipped += 1;
    else if (row.ok) {
      extended += 1;
      if (row.emailed) emailed += 1;
      if (row.delivery && row.delivery.sent === false && sendEmail !== false && !dryRun && !row.delivery.skipped) {
        failed += 1;
      }
    } else {
      failed += 1;
    }
  }

  return {
    ok: failed === 0,
    dryRun: Boolean(dryRun),
    days: clampDays(days),
    requested: list.length,
    extended,
    emailed,
    skipped,
    failed,
    details,
  };
}

module.exports = {
  DEFAULT_DAYS,
  STAMP_KEY,
  EMAIL_STAMP_KEY,
  SEP_2026_EXPIRED_LOCKER,
  normalizeEmail,
  clampDays,
  shouldSkipWinbackEmail,
  greetingName,
  getLockerWinbackEmail,
  buildLockerWinbackBodyHtml,
  parseEmailList,
  extendOneExpiredLocker,
  runLockerWinback,
};
