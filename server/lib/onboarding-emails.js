const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

const ONBOARDING_SEQUENCE = [
  {
    day: 0,
    delayDays: 0,
    delayLabel: 'Immediately on signup',
    subject: 'Welcome to GatorVault — Your Access Is Live 🐊',
    cta: { label: 'Log in now and open your dashboard', url: SITE_URL },
    body: [
      'Hey there,',
      'Welcome to GatorVault — built for passionate Florida Gators football fans.',
      'Your full UF Football hub is live: Live Dashboard, Film Room, Recruiting Board, Roster Profiles, Portal Radar, and Community — all in one place.',
      'Here\'s what\'s included:',
      '🔹 Live Dashboard — Real-time commits, portal moves, beat writer posts, podcast drops, and breaking news.',
      '🔹 Film Room — Scheme breakdowns, personnel analysis, and matchup intel.',
      '🔹 Recruiting Board — Targets, commits, flips, evaluations, and class movement.',
      '🔹 Roster Profiles — Ratings, measurables, and depth-chart context for every player.',
      '🔹 Community — Member threads without message-board chaos.',
      'How to access your dashboard: sign in at gatorvaultinsider.com with the email and password you created. Open Start Here, then jump to the Live Dashboard.',
      'How alerts work: open Alerts inside the Vault, pick your categories, and choose push, email, or both. Follow specific players for personalized updates.',
      'Try these first: Live Dashboard → Depth Chart → Recruiting Board → a Film Room article → Community threads.',
      'Join the community inside the Vault — tap Community after you sign in.',
      'Your 30-day free trial is active. No credit card was charged today.',
      '— GatorVault Team'
    ]
  },
  {
    day: 1,
    delayDays: 1,
    delayLabel: '1 day after signup',
    subject: 'Getting Started — Your GatorVault Playbook',
    cta: { label: 'Open your dashboard', url: SITE_URL },
    body: [
      'Hey,',
      'Day 1 inside the Vault — here\'s the fastest way to get value today.',
      '1️⃣ Live Dashboard — Your real-time command center. Commits, portal moves, and beat writer posts land here first.',
      '2️⃣ Film Room — Clean breakdowns that explain why things happen — not just what happened.',
      '3️⃣ Recruiting Board — Targets, commits, flips, evaluations, and class movement.',
      '4️⃣ Roster Profiles — Every player\'s rating, measurables, bio, and role in one place.',
      '5️⃣ Community Threads — Real conversations. Real fans. No clutter.',
      'Start with these five and you\'ll feel the full GatorVault experience by the end of the week.',
      '— GatorVault Team'
    ]
  },
  {
    day: 2,
    delayDays: 1,
    delayLabel: '1 day after Day 1',
    subject: 'Feature Highlight — Live Feed + Film Room',
    cta: { label: 'Explore the Live Dashboard', url: SITE_URL },
    body: [
      'Hey,',
      'Two features members use every single day:',
      '🔹 Live Dashboard — The scrolling ticker and live feed pull from verified beat writers, On3, 247Sports, and Rivals public reporting. No noise, no rumors without a source.',
      '🔹 Film Room — Original GatorVault write-ups based on real public reporting from trusted Florida beat writers. We synthesize — we don\'t invent.',
      'Open the Vault, tap Live, and scroll the feed. Then open Film Room and read the latest drop.',
      'That\'s the core loop — real intel, organized for you.',
      '— GatorVault Team'
    ]
  },
  {
    day: 3,
    delayDays: 1,
    delayLabel: '1 day after Day 2',
    subject: 'Recruiting Tools — Board, Portal & Player Profiles',
    cta: { label: 'Open the Recruiting Board', url: SITE_URL },
    body: [
      'Hey,',
      'Recruiting season never stops — GatorVault keeps you ahead.',
      '🔹 Recruiting Board — Class rankings, commits, and targets updated from public On3 / 247 / Rivals data.',
      '🔹 Portal Radar — Incoming and outgoing portal movement with player profile links.',
      '🔹 Player Profiles — Measurables, ratings, offers, and scouting context on every recruit.',
      'Tip: follow specific players in Alerts to get commit and portal notifications instantly.',
      '— GatorVault Team'
    ]
  },
  {
    day: 5,
    delayDays: 2,
    delayLabel: '2 days after Day 3',
    subject: 'War Room Overview — Insider Scouting Access',
    cta: { label: 'See War Room features', url: SITE_URL },
    body: [
      'Hey,',
      'War Room is the deepest tier in GatorVault — built for fans who want verified scouting intel, not message-board noise.',
      '🔹 Scouting Database — Verified breakdowns sourced from Rivals, On3, and 247 public reporting. Original GatorVault presentation — never AI-generated filler.',
      '🔹 Heat Check — Crystal Ball momentum and trending recruiting intel.',
      '🔹 Full player breakdowns on every profile — strengths, weaknesses, scheme fit, and sources cited.',
      'Film Room and Locker Room members see locked teasers. War Room unlocks everything.',
      '— GatorVault Team'
    ]
  },
  {
    day: 7,
    delayDays: 2,
    delayLabel: '2 days after Day 5',
    subject: 'Heat Check + Scouting — Trending Intel',
    cta: { label: 'Open Heat Check', url: SITE_URL },
    body: [
      'Hey,',
      'You\'re a week in — two War Room features worth exploring:',
      '🔹 Heat Check — Trending recruits, Crystal Ball movement, and momentum shifts pulled from public recruiting feeds.',
      '🔹 Scouting Tab — Verified scouting summaries on top targets. Every breakdown cites real public sources.',
      'Even on Film Room access, you can preview locked scouting cards and see what War Room unlocks.',
      '— GatorVault Team'
    ]
  },
  {
    day: 10,
    delayDays: 3,
    delayLabel: '3 days after Day 7',
    subject: 'Mobile App Features — GatorVault On The Go',
    cta: { label: 'Open GatorVault on mobile', url: SITE_URL },
    body: [
      'Hey,',
      'GatorVault is built mobile-first — take the Vault everywhere.',
      '🔹 Live ticker at the top of every page — commits and portal moves scroll in real time.',
      '🔹 Bottom nav: Home, Live, Recruiting, Scouting, and More — one tap to any section.',
      '🔹 Top banner alerts for commits, portal entries, and breaking intel — impossible to miss.',
      'Add GatorVault to your home screen for instant access on gameday.',
      '— GatorVault Team'
    ]
  },
  {
    day: 14,
    delayDays: 4,
    delayLabel: '4 days after Day 10',
    subject: 'Upgrade CTA — Keep Your Vault Access',
    cta: { label: 'Keep your access', url: SITE_URL },
    body: [
      'Hey,',
      'Your GatorVault trial is almost over — and once it ends, you\'ll lose access to:',
      'Live Dashboard, Beat writer stream, Podcast Hub, Film Room, Recruiting Board, Roster Profiles, Community Threads, and Breaking alerts.',
      'If you\'ve enjoyed the clean, organized, insider-style experience, don\'t let your access expire.',
      'Stay in the Vault.',
      'Thanks for being part of this,',
      'GatorVault Team'
    ]
  }
];

function onboardingEmailHtml(emailDef, { name } = {}) {
  const displayName = name || 'there';
  const lines = emailDef.body.map((line) => {
    if (line.startsWith('Hey')) {
      return `<p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6;">${line.replace('Hey there,', `Hey ${displayName},`).replace('Hey,', `Hey ${displayName},`)}</p>`;
    }
    if (line.startsWith('❌') || line.startsWith('✔️') || line.startsWith('🔹') || /^\d️⃣/.test(line)) {
      return `<p style="margin:0 0 8px;font-size:14px;color:#cbd5e1;line-height:1.55;">${line}</p>`;
    }
    if (line.startsWith('—') || line.endsWith('Team')) {
      return `<p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">${line}</p>`;
    }
    return `<p style="margin:0 0 14px;font-size:15px;color:#e2e8f0;line-height:1.6;">${line}</p>`;
  }).join('');

  const cta = emailDef.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto 8px;"><tr><td style="border-radius:10px;background:#FA4616;">
        <a href="${emailDef.cta.url}" style="display:inline-block;padding:16px 32px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:Oswald,Arial,sans-serif;letter-spacing:1px;">${emailDef.cta.label} →</a>
      </td></tr></table>`
    : '';

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
<tr><td style="background:#060f1f;padding:32px;">${lines}${cta}</td></tr>
<tr><td style="background:#030712;padding:18px 32px;text-align:center;border-top:1px solid #1e3a5f;">
  <p style="margin:0;font-size:11px;color:#475569;">GatorVault © 2026 · Not affiliated with the University of Florida</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function getDay0Email({ name, email, tier }) {
  const day0 = ONBOARDING_SEQUENCE[0];
  return {
    subject: day0.subject,
    html: onboardingEmailHtml(day0, { name: name || (email || '').split('@')[0] }),
    tier
  };
}

function getOnboardingEmailByDay(day, { name } = {}) {
  const emailDef = ONBOARDING_SEQUENCE.find((e) => e.day === day);
  if (!emailDef) return null;
  return {
    subject: emailDef.subject,
    html: onboardingEmailHtml(emailDef, { name }),
    day: emailDef.day
  };
}

module.exports = {
  ONBOARDING_SEQUENCE,
  onboardingEmailHtml,
  getDay0Email,
  getOnboardingEmailByDay
};
