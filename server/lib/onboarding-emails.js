const VAULT_URL = process.env.GV_VAULT_URL || 'https://gatorvault.com/vault';
const SUPPORT_EMAIL = process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com';

const WELCOME_SUBJECT = 'Welcome to GatorVault — Your Access Is Now Live 🐊🔥';

const TIER_LABELS = {
  film: 'Film Room',
  locker: 'Locker Room',
  war: 'War Room'
};

const TIER_BENEFITS = {
  film: [
    'Full cinematic vault access',
    'Unlimited downloads',
    'Weekly new drops',
    'Early access to premium releases',
    'Member-only requests',
    'Priority support'
  ],
  locker: [
    'Everything in Film Room',
    'Locker Room exclusive drops',
    'Extended archive access',
    'Member-only requests',
    'Priority support',
    'Early access to premium releases'
  ],
  war: [
    'Everything in Locker Room',
    'War Room scouting intel',
    'Full player breakdowns',
    'Heat Check recruiting momentum',
    'Front-of-line priority support',
    'Earliest access to premium releases'
  ]
};

/** Single welcome email — replaces all follow-up onboarding emails. */
const ONBOARDING_SEQUENCE = [
  {
    day: 0,
    delayDays: 0,
    delayLabel: 'Immediately on signup',
    subject: WELCOME_SUBJECT
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

function welcomeEmailHtml({ name, email, tier } = {}) {
  const displayName = name || (email ? email.split('@')[0] : 'there');
  const tierLabel = getTierLabel(tier);
  const benefits = getTierBenefitsHtml(tier);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030712;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #1e3a5f;">
<tr><td style="background:linear-gradient(135deg,#001a4d 0%,#003087 100%);padding:24px 32px;text-align:center;">
  <div style="font-size:36px;line-height:1;margin-bottom:6px;">🐊</div>
  <div style="font-family:Oswald,Arial,sans-serif;font-size:24px;font-weight:700;color:#FA4616;letter-spacing:3px;">GATORVAULT</div>
</td></tr>
<tr><td style="background:#060f1f;padding:32px;color:#e2e8f0;">
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Welcome to GatorVault — your membership is officially active and your vault is open.</p>

  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🔑 Your Access</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Your vault is now unlocked.</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">Use the email you signed up with to enter the member area:<br>
  <a href="${VAULT_URL}" style="color:#FA4616;">${VAULT_URL}</a></p>

  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎬 Your Tier: ${tierLabel}</p>
  <ul style="margin:0 0 20px;padding-left:20px;">${benefits}</ul>

  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📦 What Happens Next</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Your vault stays unlocked for the full 30-day trial.</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">New drops appear automatically — no extra emails needed.</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Request custom scenes anytime: <a href="mailto:${SUPPORT_EMAIL}" style="color:#FA4616;">${SUPPORT_EMAIL}</a></p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Membership renews automatically unless canceled.</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">You can upgrade/downgrade anytime inside your vault.</p>

  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🧭 Quick Start Guide</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Bookmark your vault</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Check &ldquo;New Drops&rdquo; regularly</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Use the Request button for custom content</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Save favorites</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">Explore the Hidden Vault</p>

  <p style="margin:0 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🛠 Support</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#FA4616;">${SUPPORT_EMAIL}</a></p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.55;">Response time: under 24 hours</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">Priority: ${tierLabel} gets front-of-line support</p>

  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Welcome to the Vault.<br>🐊🔥</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Team</p>
</td></tr>
<tr><td style="background:#030712;padding:18px 32px;text-align:center;border-top:1px solid #1e3a5f;">
  <p style="margin:0;font-size:11px;color:#475569;">GatorVault © 2026</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function getWelcomeEmail({ name, email, tier }) {
  const tierLabel = getTierLabel(tier);
  return {
    subject: WELCOME_SUBJECT,
    html: welcomeEmailHtml({ name, email, tier }),
    tier: tierLabel,
    templateParams: {
      name: name || (email || '').split('@')[0],
      email: email || '',
      tier: tierLabel,
      tier_benefits: getTierBenefitsHtml(tier),
      vault_url: VAULT_URL,
      support_email: SUPPORT_EMAIL
    }
  };
}

/** @deprecated Use getWelcomeEmail — kept for test route compatibility. */
function getDay0Email(opts) {
  return getWelcomeEmail(opts);
}

/** @deprecated Follow-up onboarding emails disabled. */
function getOnboardingEmailByDay(day, opts) {
  if (Number(day) !== 0) return null;
  return getWelcomeEmail(opts);
}

/** @deprecated Use welcomeEmailHtml */
function onboardingEmailHtml(emailDef, opts) {
  return welcomeEmailHtml(opts);
}

module.exports = {
  WELCOME_SUBJECT,
  VAULT_URL,
  ONBOARDING_SEQUENCE,
  getTierLabel,
  getTierBenefits,
  getTierBenefitsHtml,
  welcomeEmailHtml,
  getWelcomeEmail,
  getDay0Email,
  getOnboardingEmailByDay,
  onboardingEmailHtml
};
