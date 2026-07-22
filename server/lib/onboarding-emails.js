// Live product host is gatorvaultinsider.com — gatorvault.com/vault 404s and must not be emailed.
const SITE_URL = String(process.env.SITE_URL || 'https://gatorvaultinsider.com').replace(/\/$/, '');
const VAULT_URL = process.env.GV_VAULT_URL || `${SITE_URL}/join/?mode=signin&next=/vault/`;
const MEMBERSHIP_URL = process.env.GV_MEMBERSHIP_URL || `${SITE_URL}/vault/membership/`;
const VAULT_LINK_LABEL = 'Open your vault';
const MEMBERSHIP_LINK_LABEL = 'Choose your membership';
const VAULT_URL_DISPLAY = `${SITE_URL.replace(/^https?:\/\//, '')}/join`;
const SUPPORT_EMAIL = process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com';

const WELCOME_SUBJECT = 'Welcome to GatorVault — Your Insider Access Is Live';

const TIER_LABELS = {
  film: 'Film Room',
  locker: 'Locker Room',
  war: 'War Room'
};

const TIER_BENEFITS = {
  film: [
    'Recruiting hub + Closing Class board',
    'FutureCast visit intel',
    'Film Room breakdowns',
    'Home beat feed',
    'Community threads',
    'Priority support'
  ],
  locker: [
    'Everything in Film Room',
    'Full recruiting + FutureCast surfaces',
    'Team roster, depth chart, and staff',
    'Community + alerts',
    'Priority support',
    'iOS membership upgrade path'
  ],
  war: [
    'Everything in Locker Room',
    'War Room scouting depth',
    'Heat + pipeline intel',
    'Front-of-line priority support',
    'Earliest premium drops',
    'Full insider stack'
  ]
};

/**
 * Server drip after Day 0 welcome.
 * Day numbers = days since signup (createdAt / trialStart).
 */
const ONBOARDING_SEQUENCE = [
  {
    day: 0,
    delayDays: 0,
    delayLabel: 'Immediately on signup',
    subject: WELCOME_SUBJECT,
    kind: 'welcome'
  },
  {
    day: 1,
    delayDays: 1,
    delayLabel: '1 day after signup',
    subject: 'Your GatorVault playbook — start here',
    kind: 'activate'
  },
  {
    day: 3,
    delayDays: 3,
    delayLabel: '3 days after signup',
    subject: 'Stay ahead of every Gator move',
    kind: 'recruiting'
  },
  {
    day: 7,
    delayDays: 7,
    delayLabel: '7 days after signup',
    subject: 'Your trial checklist — do not miss these',
    kind: 'checklist'
  },
  {
    day: 25,
    delayDays: 25,
    delayLabel: '25 days after signup',
    subject: 'Your trial ends soon — keep your vault open',
    kind: 'trial_ending'
  }
];

/** Trial-clock reminders (based on daysLeft, not signup day). */
const TRIAL_REMINDER_SEQUENCE = [
  {
    key: 'd5',
    daysLeft: 5,
    subject: '5 days left in your GatorVault trial',
    kind: 'trial_d5'
  },
  {
    key: 'd1',
    daysLeft: 1,
    subject: 'Last day of your GatorVault trial',
    kind: 'trial_d1'
  }
];

function normalizeTierKey(tier) {
  const t = String(tier || 'film').toLowerCase();
  if (t.includes('war')) return 'war';
  if (t.includes('locker')) return 'locker';
  return 'film';
}

function getTierLabel(tier) {
  return TIER_LABELS[normalizeTierKey(tier)] || TIER_LABELS.film;
}

function getTierBenefits(tier) {
  return TIER_BENEFITS[normalizeTierKey(tier)] || TIER_BENEFITS.film;
}

function getTierBenefitsHtml(tier) {
  return getTierBenefits(tier)
    .map((item) => `<li style="margin:0 0 6px;font-size:14px;color:#cbd5e1;line-height:1.55;">${item}</li>`)
    .join('');
}

function displayNameFrom({ name, email } = {}) {
  return name || (email ? String(email).split('@')[0] : 'there');
}

function ctaButton(href, label) {
  return `<p style="margin:0 0 10px;">
    <a href="${href}" style="display:inline-block;background:#FA4616;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;">${label}</a>
  </p>`;
}

function emailShell(innerHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030712;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #1e3a5f;">
<tr><td style="background:linear-gradient(135deg,#001a4d 0%,#003087 100%);padding:24px 32px;text-align:center;">
  <div style="font-family:Oswald,Arial,sans-serif;font-size:24px;font-weight:700;color:#FA4616;letter-spacing:3px;">GATORVAULT</div>
</td></tr>
<tr><td style="background:#060f1f;padding:32px;color:#e2e8f0;font-family:Inter,Arial,sans-serif;">
${innerHtml}
</td></tr>
<tr><td style="background:#030712;padding:18px 32px;text-align:center;border-top:1px solid #1e3a5f;">
  <p style="margin:0;font-size:11px;color:#475569;font-family:Inter,Arial,sans-serif;">© 2026 GatorVault Media, LLC · Not affiliated with the University of Florida</p>
  <p style="margin:8px 0 0;font-size:11px;color:#475569;font-family:Inter,Arial,sans-serif;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function welcomeBodyHtml({ name, email, tier, trialEndStr } = {}) {
  const displayName = displayNameFrom({ name, email });
  const tierLabel = getTierLabel(tier);
  const benefits = getTierBenefitsHtml(tier);
  const trialLine = trialEndStr
    ? `Your free 30-day trial runs through <strong>${trialEndStr}</strong>. No payment method is required during the trial.`
    : 'Your free 30-day trial is active. No payment method is required during the trial.';

  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Welcome to GatorVault — Florida football intel built for fans who want the board, the film, and the beat in one vault.</p>
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your access</p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">Sign in with the email you used at signup:</p>
  ${ctaButton(VAULT_URL, VAULT_LINK_LABEL)}
  <p style="margin:0 0 14px;font-size:13px;color:#94a3b8;line-height:1.55;">${VAULT_URL_DISPLAY}</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">On iPhone, open the <strong>GatorVault</strong> app and sign in with that same email.</p>
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Trial tier: ${tierLabel}</p>
  <ul style="margin:0 0 20px;padding-left:20px;">${benefits}</ul>
  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">What happens next</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">${trialLine}</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">We’ll send a short playbook over the next week so you don’t miss Recruiting, Film Room, or Community.</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">After your trial, continue in the iOS app with Apple In-App Purchase. App Store subscriptions renew automatically unless canceled at least 24 hours before the period ends.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Welcome to the vault.</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function activateBodyHtml({ name, email } = {}) {
  const displayName = displayNameFrom({ name, email });
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Day one in the vault — hit these three surfaces and you’ll feel why GatorVault exists:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;"><strong>1. Recruiting</strong> — Closing Class board, movement, and real hunt targets.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;"><strong>2. Film Room</strong> — scheme and breakdown work that matches the current staff.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.55;"><strong>3. Home / Beat</strong> — the pulse without the noise.</p>
  ${ctaButton(VAULT_URL, VAULT_LINK_LABEL)}
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function recruitingBodyHtml({ name, email } = {}) {
  const displayName = displayNameFrom({ name, email });
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Recruiting is where GatorVault earns its keep. Open the hub and check:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">• Closing Class battle board (hunt targets only)</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">• FutureCast visit intel</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">• Pipeline + position rooms</p>
  ${ctaButton(`${SITE_URL}/vault/recruiting/`, 'Open Recruiting')}
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function checklistBodyHtml({ name, email } = {}) {
  const displayName = displayNameFrom({ name, email });
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">One week in — run this checklist so your trial isn’t wasted:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">☑ Open Recruiting and scan Closing Class</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">☑ Read one Film Room / Scheme School piece</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">☑ Check Team roster + depth chart</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;">☑ Join or follow a Community thread</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">☑ Turn on visit alerts if you want OV emails</p>
  ${ctaButton(VAULT_URL, 'Finish your checklist')}
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function trialEndingBodyHtml({ name, email, trialEndStr, daysLeft } = {}) {
  const displayName = displayNameFrom({ name, email });
  const when = trialEndStr
    ? `Your trial ends <strong>${trialEndStr}</strong>${daysLeft != null ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ''}.`
    : 'Your trial is almost over.';
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${when}</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Keep Recruiting, Film Room, FutureCast, and Community unlocked — choose your membership in the GatorVault iOS app (Apple In-App Purchase). Same account works on the web after you subscribe.</p>
  ${ctaButton(MEMBERSHIP_URL, MEMBERSHIP_LINK_LABEL)}
  <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;line-height:1.55;">Already subscribed? Open the app → Membership → Restore Purchases.</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
}

function bodyHtmlForKind(kind, opts = {}) {
  switch (kind) {
    case 'welcome':
      return welcomeBodyHtml(opts);
    case 'activate':
      return activateBodyHtml(opts);
    case 'recruiting':
      return recruitingBodyHtml(opts);
    case 'checklist':
      return checklistBodyHtml(opts);
    case 'trial_ending':
    case 'trial_d5':
    case 'trial_d1':
      return trialEndingBodyHtml(opts);
    default:
      return welcomeBodyHtml(opts);
  }
}

function buildEmailPayload(def, opts = {}) {
  const bodyInner = bodyHtmlForKind(def.kind, opts);
  const html = emailShell(bodyInner);
  const tierLabel = getTierLabel(opts.tier);
  return {
    day: def.day,
    key: def.key || null,
    kind: def.kind,
    subject: def.subject,
    html,
    tier: tierLabel,
    templateParams: {
      name: displayNameFrom(opts),
      email: opts.email || '',
      tier: tierLabel,
      tier_benefits: getTierBenefitsHtml(opts.tier),
      body_html: bodyInner,
      vault_url: def.kind && String(def.kind).startsWith('trial') ? MEMBERSHIP_URL : VAULT_URL,
      vault_link_label: def.kind && String(def.kind).startsWith('trial') ? MEMBERSHIP_LINK_LABEL : VAULT_LINK_LABEL,
      vault_url_display: VAULT_URL_DISPLAY,
      support_email: SUPPORT_EMAIL,
      trial_end: opts.trialEndStr || '',
      email_subject: def.subject,
    }
  };
}

function getWelcomeEmail(opts = {}) {
  return buildEmailPayload(ONBOARDING_SEQUENCE[0], opts);
}

function getOnboardingEmailByDay(day, opts = {}) {
  const def = ONBOARDING_SEQUENCE.find((e) => Number(e.day) === Number(day));
  if (!def) return null;
  return buildEmailPayload(def, opts);
}

function getTrialReminderEmail(daysLeft, opts = {}) {
  const target = Number(daysLeft);
  const def = TRIAL_REMINDER_SEQUENCE.find((e) => e.daysLeft === target);
  if (!def) return null;
  return buildEmailPayload(def, { ...opts, daysLeft: target });
}

function welcomeEmailHtml(opts = {}) {
  return getWelcomeEmail(opts).html;
}

function onboardingEmailHtml(emailDef, opts = {}) {
  const def = typeof emailDef === 'object' && emailDef
    ? emailDef
    : ONBOARDING_SEQUENCE.find((e) => Number(e.day) === Number(emailDef)) || ONBOARDING_SEQUENCE[0];
  return buildEmailPayload(def, opts).html;
}

function getDay0Email(opts) {
  return getWelcomeEmail(opts);
}

module.exports = {
  WELCOME_SUBJECT,
  SITE_URL,
  VAULT_URL,
  MEMBERSHIP_URL,
  VAULT_LINK_LABEL,
  MEMBERSHIP_LINK_LABEL,
  VAULT_URL_DISPLAY,
  ONBOARDING_SEQUENCE,
  TRIAL_REMINDER_SEQUENCE,
  getTierLabel,
  getTierBenefits,
  getTierBenefitsHtml,
  welcomeEmailHtml,
  getWelcomeEmail,
  getDay0Email,
  getOnboardingEmailByDay,
  getTrialReminderEmail,
  onboardingEmailHtml,
  buildEmailPayload,
};
