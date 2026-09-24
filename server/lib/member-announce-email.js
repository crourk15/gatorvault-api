/**
 * One-shot member announcements (e.g. App Store version live).
 */
'use strict';

const fs = require('fs');
const path = require('path');
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
const FUTURECAST_ANNOUNCE_URL = `${SITE_URL}/join/?mode=signin&next=${encodeURIComponent('/vault/futurecast/')}`;

const IOS_129_CHASE_VERSION = '1.0.29';
const IOS_129_CHASE_STAMP_KEY = 'iosAnnounce_1_0_29_chase';
const IOS_129_CHASE_SUBJECT =
  'GatorVault 1.0.29 is live — 2028 is heating up. Here’s how to read it.';

function ios129ChaseReportPath() {
  const usersPath = process.env.GV_USERS_PATH || path.join(__dirname, '..', 'data', 'users.json');
  return path.join(path.dirname(usersPath), 'ios-129-chase-announce-last.json');
}

function readIos129ChaseReport() {
  try {
    return JSON.parse(fs.readFileSync(ios129ChaseReportPath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeIos129ChaseReport(payload) {
  try {
    fs.writeFileSync(ios129ChaseReportPath(), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.warn('[announce-ios-129] report write failed', err instanceof Error ? err.message : err);
  }
}

function summarizeIos129ChaseResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    ok: result.ok !== false,
    at: result.at || null,
    sent: result.sent || 0,
    failed: result.failed || 0,
    queued: result.queued || 0,
    candidateCount: result.candidateCount || 0,
    skippedCount: result.skippedCount || 0,
    alreadySent: result.alreadySent || 0,
    delivered: result.delivered === true,
    deliveredViaResend: result.deliveredViaResend === true,
    dryRun: result.dryRun === true,
    force: result.force === true,
    error: result.error || null,
  };
}

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

const SEASON_PREVIEW_2026_URL =
  `${SITE_URL}/vault/articles/art-season-preview-2026-eight-days/`;

function buildArticleAnnounceBodyHtml({
  name,
  email,
  articleUrl,
  articleTitle,
  introHtml,
} = {}) {
  const displayName = displayNameFrom({ name, email });
  const url = String(articleUrl || '').trim() || SEASON_PREVIEW_2026_URL;
  const title =
    String(articleTitle || '').trim() || 'Eight Days Out: What This Florida Season Actually Is';
  const intro =
    String(introHtml || '').trim() ||
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Eight days from kickoff. Philo has the keys, Baugh is the engine, Graham is the heartbeat — and the full season preview is live in your Vault.</p>`;
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  ${intro}
  <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#94a3b8;">${title}</p>
  ${ctaButton(url, 'Read the season preview')}
  <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.55;word-break:break-all;">${url}</p>
  <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.55;">— GatorVault</p>
  <p style="margin:12px 0 0;font-size:12px;color:#475569;line-height:1.55;">Questions? Reply or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a>.</p>
`;
}

function getArticleAnnounceEmail(opts = {}) {
  const articleUrl = String(opts.articleUrl || SEASON_PREVIEW_2026_URL).trim();
  const articleTitle =
    String(opts.articleTitle || '').trim() ||
    'Eight Days Out: What This Florida Season Actually Is';
  const subject =
    String(opts.subject || '').trim() ||
    'Season preview live — eight days out';
  const bodyInner = buildArticleAnnounceBodyHtml({
    ...opts,
    articleUrl,
    articleTitle,
  });
  const html = emailShell(bodyInner);
  return {
    kind: 'member_article_announce',
    articleUrl,
    articleTitle,
    subject,
    html,
    templateParams: {
      name: displayNameFrom(opts),
      email: opts.email || '',
      body_html: bodyInner,
      email_subject: subject,
      vault_url: articleUrl,
      support_email: SUPPORT_EMAIL,
    },
  };
}

/**
 * One-shot member email for a published Vault article (stampKey prevents re-blast).
 */
async function sendArticleAnnounce({
  loadUsers,
  deliverEmail,
  updateUser = null,
  saveUsers = null,
  articleUrl = SEASON_PREVIEW_2026_URL,
  articleTitle = 'Eight Days Out: What This Florida Season Actually Is',
  subject = 'Season preview live — eight days out',
  introHtml = '',
  stampKey = 'articleAnnounce_season_preview_2026_eight_days',
  dryRun = false,
  force = false,
  requireActiveAccess = true,
  limit = null,
  concurrency = announceEmailConcurrency(),
  saveEvery = announceSaveEvery(),
} = {}) {
  if (typeof loadUsers !== 'function' || typeof deliverEmail !== 'function') {
    throw new Error('sendArticleAnnounce requires loadUsers and deliverEmail');
  }

  const key = String(stampKey || 'articleAnnounce_custom')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 80);
  const { recipients, skipped } = listAnnounceRecipients(loadUsers, { requireActiveAccess });
  const queue =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? recipients.slice(0, Number(limit))
      : recipients;

  const details = [];
  let sent = 0;
  let failed = 0;
  let sinceSave = 0;

  let stampChain = Promise.resolve();
  function enqueueStamp(work) {
    const run = stampChain.then(work);
    stampChain = run.catch(() => {});
    return run;
  }

  async function persistStamp(user) {
    const iso = new Date().toISOString();
    user[key] = iso;
    if (typeof updateUser === 'function') {
      await enqueueStamp(async () => {
        updateUser(user.email, { [key]: iso });
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
    if (!force && user[key]) {
      details.push({ email: user.email, sent: false, reason: 'already_sent' });
      return;
    }

    const built = getArticleAnnounceEmail({
      email: user.email,
      name: user.name,
      articleUrl,
      articleTitle,
      subject,
      introHtml,
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
    kind: 'member_article_announce',
    stampKey: key,
    articleUrl,
    articleTitle,
    subject,
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

function sectionLabel(text) {
  return `<p style="margin:20px 0 8px;font-size:13px;color:#FA4616;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${text}</p>`;
}

function buildIos129ChaseBodyHtml({ name, email } = {}) {
  const displayName = displayNameFrom({ name, email });
  return `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">GatorVault Insider <strong>${IOS_129_CHASE_VERSION}</strong> is on the App Store. Update when you have a second — this one is the version that matches the live vault.</p>
  ${sectionLabel('What changed in 1.0.29')}
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Home NOW</strong> opens with Game, Visitors, and Season already on the page. No waiting on a ticker, no snap-back to a stale class rank.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Game Week</strong> is already on Ole Miss when you tap in — keys, scout, and swing, not a placeholder that swaps five seconds later.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><strong>Swing Impact</strong> is a real player grade now, not a list-order number. You’ll see that on the Game Week board this week.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Same login on iPhone and the web. Alerts and membership carry over.</p>
  ${sectionLabel('The other reason to open the app this week')}
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">The <strong>2028</strong> class is moving. Visits are on the calendar. Offers are stacking. If you only glance at crystal-ball percentages, you will miss who Florida is actually working and who looks close to a decision.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Open <strong>FutureCast</strong>. Two boards. Two different questions. That is the whole trick.</p>
  ${sectionLabel('1. Priority Chase — who Florida is hunting')}
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">This is the staff-heat list. Not “who commits tomorrow.” Who we are chasing hardest right now.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Each card is stamped <strong>#1 Chase, #2 Chase,</strong> and so on.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Read it in this order:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Why we chase</strong> — the one-sentence reason that name is on the board. Staff heat, a thin room, an in-state pipeline kid, a visit that just got set. Start here. If you only read one line, read this one.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>UF Shot</strong> — Florida’s chance on <em>our</em> board, not a national ranking.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Fit</strong> — how well the player matches what this roster actually needs.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Priority</strong> — how hot the chase is this week.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Expected visit</strong> — when a campus visit is on the books, it sits on the card. A visit is process. Treat it that way.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Who’s ahead · On3</strong> — the public crystal-ball race. Industry prediction. Useful. Not the same thing as our chase rank.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;"><strong>On3 lead</strong> — who the industry currently has winning that race.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Badges to notice: <strong>In-state</strong>, <strong>Hot chase</strong> on #1, <strong>Rising</strong> when Florida’s odds moved up this week.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">A kid can sit at <strong>#1 Chase</strong> and still have someone else leading On3. That is not a bug. It means staff is on him and the public board has not caught up — or we are hunting a name the industry has elsewhere. Chase is “who we want and who we are working.” On3 is “who the industry thinks is winning.”</p>
  ${sectionLabel('2. Closest to commit — who looks next')}
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Different question. Who Florida is <strong>ahead</strong> on, and who looks nearest to picking a school.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">For 2028 this list is <strong>process-backed only</strong>. A Florida offer, visits, and real intel. A pretty On3 percentage by itself does not put a name here.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Stamps:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Closest to commit</strong> — Florida is still in it, and the process says a decision is nearer.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;"><strong>Florida ahead</strong> — we lead the board on that player. Not the same as “he’s committing this weekend.”</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Then the facts:</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Board lead</strong> — who Florida is beating, and by how much. “Leads Georgia by 12” is the race that matters on this card.</p>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Florida chance</strong> — our odds on that player.</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;"><strong>7-day move</strong> — up, down, or flat this week. One quiet week is not a flip. A drop plus a visit to someone else is a story.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Read Chase to know <strong>who we are after</strong>. Read Closest to know <strong>where Florida is actually winning and who might come off the board next</strong>. The same name can sit on both. A lot of the interesting ones sit on only one.</p>
  ${sectionLabel('Every name has a full player profile')}
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Tap any player — Chase, Closest, Recruiting, Expected visitors, class cards. You are not stuck on the scoreboard.</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">The profile is the scouting report:</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.6;">• Who he is, where he plays, the offer / visit trail</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.6;">• Who else is in the race</p>
  <p style="margin:0 0 6px;font-size:14px;line-height:1.6;">• Vault Scouting when we have tape on him — what shows on film, the comparison, the projection</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">• The intel that moved him onto the board</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">The cards tell you where the race stands. The profile tells you <em>why</em> that kid matters and what kind of player he is. If you have not opened a 2028 profile yet, start with whoever is #1 Chase and whoever is stamped Closest to commit. That is ten minutes well spent.</p>
  ${sectionLabel('Do this')}
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">1. On iPhone: App Store → <strong>GatorVault Insider</strong> → <strong>Update</strong></p>
  ${ctaButton(APP_STORE_URL, 'Update on the App Store')}
  <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:1.55;word-break:break-all;">${APP_STORE_URL}</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">2. Open <strong>FutureCast</strong> → 2028 <strong>Priority Chase</strong>, then <strong>Closest to commit</strong></p>
  ${ctaButton(FUTURECAST_ANNOUNCE_URL, 'Open FutureCast')}
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">3. Tap a name. Read the profile.</p>
  <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.55;">— GatorVault</p>
  <p style="margin:12px 0 0;font-size:12px;color:#475569;line-height:1.55;">Questions? Reply or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8;">${SUPPORT_EMAIL}</a>.</p>
`;
}

function getIos129ChaseAnnounceEmail(opts = {}) {
  const subject = String(opts.subject || '').trim() || IOS_129_CHASE_SUBJECT;
  const bodyInner = buildIos129ChaseBodyHtml(opts);
  const html = emailShell(bodyInner);
  return {
    kind: 'ios_1_0_29_chase',
    version: IOS_129_CHASE_VERSION,
    subject,
    html,
    templateParams: {
      name: displayNameFrom(opts),
      email: opts.email || '',
      body_html: bodyInner,
      email_subject: subject,
      vault_url: FUTURECAST_ANNOUNCE_URL,
      support_email: SUPPORT_EMAIL,
    },
  };
}

/**
 * One-shot 1.0.29 + 2028 Chase / Closest walkthrough.
 * Stamps iosAnnounce_1_0_29_chase so a retry does not re-blast.
 */
async function sendIos129ChaseAnnounce({
  loadUsers,
  deliverEmail,
  updateUser = null,
  saveUsers = null,
  dryRun = false,
  force = false,
  requireActiveAccess = true,
  limit = null,
  concurrency = announceEmailConcurrency(),
  saveEvery = announceSaveEvery(),
} = {}) {
  if (typeof loadUsers !== 'function' || typeof deliverEmail !== 'function') {
    throw new Error('sendIos129ChaseAnnounce requires loadUsers and deliverEmail');
  }

  const prior = readIos129ChaseReport();
  const effectiveForce = Boolean(force) || !(prior && prior.delivered === true);
  const key = IOS_129_CHASE_STAMP_KEY;
  const { recipients, skipped } = listAnnounceRecipients(loadUsers, { requireActiveAccess });
  const queue =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? recipients.slice(0, Number(limit))
      : recipients;

  const details = [];
  let sent = 0;
  let failed = 0;
  let sinceSave = 0;

  let stampChain = Promise.resolve();
  function enqueueStamp(work) {
    const run = stampChain.then(work);
    stampChain = run.catch(() => {});
    return run;
  }

  async function persistStamp(user) {
    const iso = new Date().toISOString();
    user[key] = iso;
    if (typeof updateUser === 'function') {
      await enqueueStamp(async () => {
        updateUser(user.email, { [key]: iso });
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
    if (!effectiveForce && user[key]) {
      details.push({ email: user.email, sent: false, reason: 'already_sent' });
      return;
    }

    const built = getIos129ChaseAnnounceEmail({
      email: user.email,
      name: user.name,
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
      if (!delivery || delivery.sent !== true) {
        failed += 1;
        details.push({
          email: user.email,
          sent: false,
          reason: 'send_failed',
          error: delivery?.error || 'deliverEmail returned sent=false',
          provider: delivery?.provider || null,
        });
        return;
      }
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

  const alreadySent = details.filter((d) => d.reason === 'already_sent').length;
  const deliveredViaResend = details.some((d) => d.sent && d.provider === 'resend');
  const payload = {
    ok: failed === 0,
    kind: 'ios_1_0_29_chase',
    version: IOS_129_CHASE_VERSION,
    stampKey: key,
    subject: IOS_129_CHASE_SUBJECT,
    at: new Date().toISOString(),
    dryRun,
    force: effectiveForce,
    candidateCount: recipients.length,
    queued: queue.length,
    sent,
    failed,
    skippedCount: skipped.length,
    alreadySent,
    delivered: sent > 0,
    deliveredViaResend,
    skipped: skipped.slice(0, 50),
    details,
    concurrency: dryRun ? 1 : concurrency,
  };
  if (!dryRun) writeIos129ChaseReport(summarizeIos129ChaseResult(payload));
  return payload;
}

function shouldAutoSendIos129Chase({
  env = process.env,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const raw = String(env.IOS_129_CHASE_ANNOUNCE_AUTO || '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (String(env.API_STAY_GREEN || '').toLowerCase() === 'true') return false;
  if (String(nodeEnv || '').toLowerCase() === 'test') return false;
  if (String(env.GV_TEST || '').toLowerCase() === '1' || String(env.GV_TEST || '').toLowerCase() === 'true') {
    return false;
  }
  const prod =
    String(nodeEnv || '').toLowerCase() === 'production' ||
    String(env.RENDER || '').toLowerCase() === 'true';
  return prod || raw === '1' || raw === 'true' || raw === 'on';
}

function scheduleIos129ChaseAnnounce({
  loadUsers,
  updateUser = null,
  saveUsers = null,
  deliverEmail,
  delayMs = null,
} = {}) {
  const gate = (() => {
    if (!shouldAutoSendIos129Chase()) return { scheduled: false, reason: 'disabled' };
    if (global.__GV_IOS_129_CHASE_ANNOUNCE_STARTED) return { scheduled: false, reason: 'already_started' };
    if (typeof loadUsers !== 'function' || typeof deliverEmail !== 'function') {
      return { scheduled: false, reason: 'missing_deps' };
    }
    return null;
  })();
  if (gate) {
    if (gate.reason !== 'already_started') {
      writeIos129ChaseReport({
        ok: false,
        at: new Date().toISOString(),
        pending: false,
        delivered: false,
        deliveredViaResend: false,
        error: gate.reason,
      });
    }
    return gate;
  }
  global.__GV_IOS_129_CHASE_ANNOUNCE_STARTED = true;
  const wait = Number.isFinite(Number(delayMs))
    ? Number(delayMs)
    : Math.max(5000, parseInt(process.env.IOS_129_CHASE_ANNOUNCE_BOOT_DELAY_MS || '15000', 10) || 15000);
  writeIos129ChaseReport({
    ok: true,
    at: new Date().toISOString(),
    pending: true,
    delayMs: wait,
    delivered: false,
    deliveredViaResend: false,
  });
  setTimeout(() => {
    sendIos129ChaseAnnounce({
      loadUsers,
      updateUser,
      saveUsers,
      deliverEmail,
      dryRun: false,
      requireActiveAccess: true,
    })
      .then((result) => {
        console.log(
          '[announce-ios-129]',
          JSON.stringify({
            sent: result.sent,
            queued: result.queued,
            skipped: result.skippedCount,
            failed: result.failed,
            candidateCount: result.candidateCount,
            deliveredViaResend: result.deliveredViaResend,
          })
        );
      })
      .catch((err) => {
        console.warn('[announce-ios-129]', err instanceof Error ? err.message : String(err));
      });
  }, wait);
  console.log('[announce-ios-129] scheduled in', wait, 'ms');
  return { scheduled: true, delayMs: wait };
}

module.exports = {
  DEFAULT_VERSION,
  APP_STORE_URL,
  FUTURECAST_ANNOUNCE_URL,
  SEASON_PREVIEW_2026_URL,
  IOS_129_CHASE_VERSION,
  IOS_129_CHASE_STAMP_KEY,
  IOS_129_CHASE_SUBJECT,
  shouldSkipMemberAnnounceRecipient,
  listAnnounceRecipients,
  buildIosUpdateBodyHtml,
  getIosUpdateAnnounceEmail,
  sendIosUpdateAnnounce,
  buildArticleAnnounceBodyHtml,
  getArticleAnnounceEmail,
  sendArticleAnnounce,
  buildIos129ChaseBodyHtml,
  getIos129ChaseAnnounceEmail,
  sendIos129ChaseAnnounce,
  shouldAutoSendIos129Chase,
  scheduleIos129ChaseAnnounce,
  readIos129ChaseReport,
  summarizeIos129ChaseResult,
};
