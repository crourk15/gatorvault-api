const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

const ONBOARDING_SEQUENCE = [
  {
    day: 0,
    delayDays: 0,
    delayLabel: 'Immediately on signup',
    subject: 'Welcome to GatorVault — Your Insider Access Is Live 🐊',
    cta: { label: 'Log in now and open your dashboard', url: SITE_URL },
    body: [
      'Hey there,',
      'Welcome to GatorVault — you\'re officially inside.',
      'You now have access to the most organized, accurate, and fan-driven Florida Gators platform anywhere online. No noise. No clutter. No message-board chaos. Just clean, real information.',
      'Here\'s where to start:',
      '🔹 Live Dashboard — Real-time feed of commits, portal moves, beat writer posts, podcast drops, and breaking news.',
      '🔹 Film Room — Clean breakdowns of scheme, personnel, and matchups — built for fans who want more than surface-level talk.',
      '🔹 Recruiting Board — Targets, commits, evaluations, and movement — all in one place.',
      '🔹 Roster Profiles — Every player. Every rating. Every measurable. Updated and accurate.',
      '🔹 Community — A real message board experience — without the toxicity.',
      'Your access is live. Jump in and explore.',
      'Welcome to the Vault.',
      '— GatorVault Team'
    ]
  },
  {
    day: 1,
    delayDays: 1,
    delayLabel: '1 day after Day 0',
    subject: 'Your GatorVault Playbook — Start Here',
    cta: { label: 'Open your Playbook', url: SITE_URL },
    body: [
      'Hey,',
      'Now that you\'re inside, here\'s the GatorVault Playbook — the five features that give you the most value right away.',
      '1️⃣ Live Dashboard — Your real-time command center. If something happens in Gator Nation, it hits here first.',
      '2️⃣ Film Room — Clean, simple breakdowns that explain why things happen — not just what happened.',
      '3️⃣ Recruiting Board — Targets, commits, flips, evaluations, and movement. Updated constantly.',
      '4️⃣ Roster Profiles — Every player\'s rating, measurables, bio, and role — all in one place.',
      '5️⃣ Community Threads — Real conversations. Real fans. No clutter. No drama.',
      'Start with these five and you\'ll get the full GatorVault experience.',
      'Talk soon,',
      'GatorVault Team'
    ]
  },
  {
    day: 3,
    delayDays: 2,
    delayLabel: '2 days after Day 1 (Day 3 total)',
    subject: 'Why GatorVault Was Built (And What Makes It Different)',
    cta: { label: 'What feature do you want next?', url: `mailto:gatorvaultinsider@gmail.com?subject=${encodeURIComponent('GatorVault feature request')}` },
    body: [
      'Hey,',
      'A quick story.',
      'GatorVault was built because Florida fans deserved a place that wasn\'t:',
      '❌ cluttered',
      '❌ toxic',
      '❌ full of ads',
      '❌ impossible to navigate',
      '❌ drowning in rumors',
      'You deserved something better — something clean, accurate, and built for fans who actually care about the details.',
      'So we built: a real-time Live Dashboard, a clean Film Room, a real message board, a real recruiting board, a real roster system, and a platform that updates constantly.',
      'No noise. No nonsense. Just the information you actually want.',
      'And we\'re building this with you — not at you.',
      'If there\'s something you want added, improved, or changed, tell us.',
      'Thanks for being here,',
      'GatorVault Team'
    ]
  },
  {
    day: 5,
    delayDays: 2,
    delayLabel: '2 days after Day 3 (Day 5 total)',
    subject: 'What\'s the ONE thing you want answered?',
    cta: null,
    body: [
      'Hey,',
      'We want to know one thing:',
      'What\'s the #1 question you have about the Gators right now?',
      'It could be: recruiting, QB battle, portal, coaching, scheme, depth chart, breakout players — anything.',
      'Reply with your biggest question — we use these to shape content inside the Vault.',
      'Your voice matters here.',
      '— GatorVault Team'
    ]
  },
  {
    day: 7,
    delayDays: 2,
    delayLabel: '2 days after Day 5 (Day 7 total)',
    subject: 'Your Trial Checklist — Don\'t Miss These',
    cta: { label: 'Finish your checklist', url: SITE_URL },
    body: [
      'Hey,',
      'You\'re a week into your GatorVault access — here\'s your Trial Checklist to make sure you\'re getting everything out of it.',
      '✔️ Check the Live Dashboard',
      '✔️ Read a Film Room breakdown',
      '✔️ View your favorite player\'s profile',
      '✔️ Follow a thread in the Community',
      '✔️ Check the Recruiting Board',
      '✔️ Read the weekly Vault article',
      '✔️ Explore the Podcast Hub',
      'If you hit all seven, you\'re getting the full GatorVault experience.',
      '— GatorVault Team'
    ]
  },
  {
    day: 10,
    delayDays: 3,
    delayLabel: '3 days after Day 7 (Day 10 total)',
    subject: 'You\'re 10 Days In — Here\'s What You\'ve Unlocked',
    cta: { label: 'Keep your access active', url: SITE_URL },
    body: [
      'Hey,',
      'You\'re 10 days into your GatorVault access — here\'s what you\'ve already unlocked:',
      'Real-time Live Dashboard, Beat writer stream, Podcast Hub, Film Room, Recruiting Board, Roster Profiles, Community Threads, Breaking news alerts.',
      'And here\'s what\'s coming next: more Film Room drops, more roster updates, more recruiting movement, more live features, and more insider-style breakdowns.',
      'If you\'re enjoying the Vault, now\'s the perfect time to stay locked in.',
      '— GatorVault Team'
    ]
  },
  {
    day: 14,
    delayDays: 4,
    delayLabel: '4 days after Day 10 (Day 14 total)',
    subject: 'Your Trial Ends Soon — Don\'t Lose Access',
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

module.exports = {
  ONBOARDING_SEQUENCE,
  onboardingEmailHtml,
  getDay0Email
};
