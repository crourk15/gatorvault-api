require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { mountRecruitingRoutes } = require('./lib/recruiting-routes');
const { mountContentRoutes } = require('./lib/content-routes');
const { mountCommunityRoutes } = require('./lib/community-routes');
const { mountRosterRoutes } = require('./lib/roster-routes');
const { mountLiveRoutes } = require('./lib/live-routes');
const { mountHighlightsRoutes } = require('./lib/highlights-routes');
const { mountWarRoomRoutes } = require('./lib/war-room-routes');
const { ensurePublishedSeed } = require('./lib/content-store');
const communityStore = require('./lib/community-store');

const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    'https://gatorvaultinsider.com',
    'https://www.gatorvaultinsider.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  if (origin && allowed.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Recruiting-Pin, X-Ingest-Secret, X-Content-Pin, X-Community-Pin, X-Live-Pin, X-Live-Cron, X-War-Room-Pin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(bodyParser.json({ limit: '1mb' }));

mountRecruitingRoutes(app);
mountContentRoutes(app);
mountCommunityRoutes(app);
mountRosterRoutes(app);
mountLiveRoutes(app);
mountHighlightsRoutes(app);
mountWarRoomRoutes(app);

const PORT = process.env.PORT || 3000;
const DIGEST_TOKEN = process.env.DIGEST_TOKEN || null;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const EMAIL_TEST_PIN = process.env.EMAIL_TEST_PIN || 'GV2026admin';
const EMAIL_LOG_MAX = 100;
const emailTestLogs = [];

function pushEmailLog(entry) {
  const row = { ts: new Date().toISOString(), ...entry };
  emailTestLogs.unshift(row);
  if (emailTestLogs.length > EMAIL_LOG_MAX) emailTestLogs.length = EMAIL_LOG_MAX;
  const tag = `[email:${row.level || 'info'}]`;
  if (row.level === 'error') console.error(tag, row.message, row.detail || '');
  else console.log(tag, row.message, row.detail || '');
}

function verifyTestPin(pin) {
  return !!pin && pin === EMAIL_TEST_PIN;
}

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return test === hash;
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const check = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig !== check) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function normalizeTier(tier) {
  const t = String(tier || 'film').toLowerCase();
  if (t === 'war' || t === 'elite') return 'war';
  if (t === 'locker' || t === 'vault') return 'locker';
  return 'film';
}

async function sendEmailSMTP(to, subject, html) {
  if (!process.env.SMTP_HOST) throw new Error('SMTP not configured');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || 587, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@gatorvaultinsider.com',
    to,
    subject,
    html
  });
}

async function sendEmailSendGrid(to, subject, html) {
  if (!process.env.SENDGRID_API_KEY) throw new Error('SendGrid not configured');
  return sgMail.send({
    to,
    from: process.env.SENDGRID_FROM || 'no-reply@gatorvaultinsider.com',
    subject,
    html
  });
}

const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'emailjs').toLowerCase();

function isEmailJsReady() {
  const key = process.env.EMAILJS_PRIVATE_KEY || '';
  const placeholder = !key || key === 'YOUR_PRIVATE_KEY_HERE' || key === 'your-emailjs-private-key-here';
  return !!(
    process.env.EMAILJS_PUBLIC_KEY &&
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    !placeholder
  );
}

function getEmailProviders() {
  if (EMAIL_PROVIDER === 'emailjs') return isEmailJsReady() ? ['emailjs'] : [];
  const providers = [];
  if (process.env.SENDGRID_API_KEY) providers.push('sendgrid');
  if (process.env.SMTP_HOST) providers.push('smtp');
  if (isEmailJsReady()) providers.push('emailjs');
  return providers;
}

async function sendEmailEmailJS(to, templateParams) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const onboardingDay = templateParams.onboardingDay != null ? Number(templateParams.onboardingDay) : 0;
  const templateId =
    onboardingDay > 0 && process.env.EMAILJS_ONBOARDING_TEMPLATE_ID
      ? process.env.EMAILJS_ONBOARDING_TEMPLATE_ID
      : process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!isEmailJsReady()) throw new Error('EmailJS not configured — set EMAILJS_PRIVATE_KEY in server/.env');

  const payload = {
    lib_version: '4.4.1',
    user_id: publicKey,
    service_id: serviceId,
    template_id: templateId,
    template_params: {
      to_email: to,
      user_email: to,
      email: to,
      to_name: templateParams.name || to.split('@')[0],
      user_name: templateParams.name || to.split('@')[0],
      tier_name: templateParams.tierName || 'Film Room',
      trial_end: templateParams.trialEnd || '',
      login_url: SITE_URL,
      community_url: SITE_URL,
      support_x: '@GatorVaultInsider',
      from_name: 'GatorVault Team',
      email_subject: templateParams.emailSubject || templateParams.subject || 'GatorVault Update',
      message_html: templateParams.html || templateParams.messageHtml || '',
      onboarding_day: String(onboardingDay),
      onboarding_intro: templateParams.onboardingIntro || 'Your GatorVault account is live. Here is everything included in your membership and how to get started.',
      reply_to: process.env.EMAILJS_REPLY_TO || process.env.SMTP_USER || 'support@gatorvaultinsider.com'
    }
  };
  if (privateKey) payload.accessToken = privateKey;

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function deliverEmail(to, subject, html, templateParams = {}) {
  const params = { ...templateParams, html, emailSubject: subject, subject };
  if (EMAIL_PROVIDER === 'emailjs') {
    if (!isEmailJsReady()) {
      const msg = 'EmailJS private key missing or placeholder in server/.env';
      pushEmailLog({ level: 'error', message: msg, detail: { to }, source: 'deliver' });
      return { sent: false, provider: null, error: msg };
    }
    try {
      await sendEmailEmailJS(to, params);
      pushEmailLog({ level: 'success', message: 'EmailJS send OK', detail: { to, subject }, source: 'deliver' });
      return { sent: true, provider: 'emailjs' };
    } catch (err) {
      pushEmailLog({ level: 'error', message: err.message, detail: { to, subject }, source: 'deliver' });
      throw err;
    }
  }
  if (process.env.SENDGRID_API_KEY) {
    await sendEmailSendGrid(to, subject, html);
    pushEmailLog({ level: 'success', message: 'SendGrid send OK', detail: { to }, source: 'deliver' });
    return { sent: true, provider: 'sendgrid' };
  }
  if (process.env.SMTP_HOST) {
    await sendEmailSMTP(to, subject, html);
    pushEmailLog({ level: 'success', message: 'SMTP send OK', detail: { to }, source: 'deliver' });
    return { sent: true, provider: 'smtp' };
  }
  if (isEmailJsReady()) {
    try {
      await sendEmailEmailJS(to, params);
      pushEmailLog({ level: 'success', message: 'EmailJS send OK', detail: { to, subject }, source: 'deliver' });
      return { sent: true, provider: 'emailjs' };
    } catch (err) {
      pushEmailLog({ level: 'error', message: err.message, detail: { to, subject }, source: 'deliver' });
      throw err;
    }
  }
  const msg = 'No email provider configured';
  pushEmailLog({ level: 'error', message: msg, detail: { to }, source: 'deliver' });
  return { sent: false, provider: null, error: msg };
}

const { getDay0Email, ONBOARDING_SEQUENCE } = require('./lib/onboarding-emails');
const { enrollOnboarding, isBeehiivConfigured, validateBeehiivOnBoot } = require('./lib/beehiiv');
const { startOnboardingScheduler } = require('./lib/onboarding-scheduler');

async function sendWelcomeEmail({ email, name, tier, skipIfBeehiiv = false }) {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);
  const trialEndStr = trialEnd.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const tierLabel = tier === 'war' ? 'War Room' : tier === 'locker' ? 'Locker Room' : 'Film Room';
  if (skipIfBeehiiv) {
    return { trialEndStr, emailSent: true, provider: 'beehiiv', onboardingHandled: true, error: null };
  }
  const day0 = getDay0Email({ name, email, tier });
  const delivery = await deliverEmail(email, day0.subject, day0.html, {
    name: name || email.split('@')[0],
    tierName: tierLabel,
    trialEnd: trialEndStr,
    onboardingDay: 0
  });
  return { trialEndStr, emailSent: delivery.sent, provider: delivery.provider, error: delivery.error || null };
}

async function enrollOnboardingSequence({ email, name, tier }) {
  const beehiiv = await enrollOnboarding({ email, name, tier });
  if (beehiiv.enrolled && beehiiv.automationId) {
    return { ...beehiiv, sequenceStarted: true };
  }
  if (beehiiv.enrolled && !beehiiv.automationId) {
    console.warn('[onboarding] Beehiiv subscriber added but automation ID missing — Day 0 fallback email will send');
    return { ...beehiiv, sequenceStarted: false };
  }
  return { ...beehiiv, sequenceStarted: false };
}

async function runWelcomeEmailTest({ email, name, tier }) {
  const steps = [];
  const add = (level, message, detail) => {
    const step = { level, message, detail: detail || null, at: new Date().toISOString() };
    steps.push(step);
    pushEmailLog({ level, message, detail, email, source: 'test' });
  };

  add('info', 'Welcome email test started', { email, name, tier, provider: EMAIL_PROVIDER });
  add('info', 'EmailJS readiness', {
    ready: isEmailJsReady(),
    serviceId: process.env.EMAILJS_SERVICE_ID || null,
    templateId: process.env.EMAILJS_TEMPLATE_ID || null,
    privateKeySet: !!(process.env.EMAILJS_PRIVATE_KEY && process.env.EMAILJS_PRIVATE_KEY !== 'YOUR_PRIVATE_KEY_HERE')
  });

  if (EMAIL_PROVIDER === 'emailjs' && !isEmailJsReady()) {
    add('error', 'EmailJS not configured on server', {
      hint: 'Set EMAILJS_PRIVATE_KEY in server/.env and enable non-browser API in EmailJS security settings'
    });
    return { ok: false, emailSent: false, steps };
  }

  try {
    const welcome = await sendWelcomeEmail({ email, name, tier });
    if (welcome.emailSent) {
      add('success', 'Welcome email sent', { provider: welcome.provider, trialEnd: welcome.trialEndStr });
      return { ok: true, emailSent: true, provider: welcome.provider, trialEnd: welcome.trialEndStr, steps };
    }
    add('error', 'Email was not sent', {
      error: welcome.error,
      hint: 'On EmailJS dashboard → Account → Security, enable API requests from non-browser apps'
    });
    return { ok: false, emailSent: false, error: welcome.error || 'Delivery returned sent:false', steps };
  } catch (err) {
    add('error', err.message, { hint: 'Check EmailJS template variables and Gmail service connection' });
    return { ok: false, emailSent: false, error: err.message, steps };
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();
    const tier = normalizeTier(req.body.tier);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
    }

    const users = loadUsers();
    if (users.find((u) => u.email === email)) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists. Sign in instead.' });
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const user = {
      email,
      name,
      tier,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      trialEnd: trialEnd.toISOString()
    };
    users.push(user);
    saveUsers(users);

    let trialEndStr = trialEnd.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    let emailSent = false;
    let emailProvider = null;
    let onboardingEnrolled = false;
    let onboardingProvider = null;
    try {
      const onboarding = await enrollOnboardingSequence({ email, name, tier });
      onboardingEnrolled = !!onboarding.enrolled;
      onboardingProvider = onboarding.provider || null;
      const welcome = await sendWelcomeEmail({
        email,
        name,
        tier,
        skipIfBeehiiv: onboarding.sequenceStarted
      });
      trialEndStr = welcome.trialEndStr;
      emailSent = welcome.emailSent || onboarding.sequenceStarted;
      emailProvider = onboarding.sequenceStarted ? 'beehiiv' : welcome.provider;
      if (!emailSent) {
        console.warn('onboarding email not delivered for', email, '— configure Beehiiv or EmailJS in .env');
      }
      if (onboarding.warning) console.warn('[onboarding]', onboarding.warning);
      if (onboarding.error && !onboarding.enrolled) console.warn('[onboarding] Beehiiv enroll failed:', onboarding.error);
      user.onboardingSent = onboarding.sequenceStarted ? ['beehiiv'] : welcome.emailSent ? [0] : [];
      user.onboardingProvider = onboarding.sequenceStarted ? 'beehiiv' : 'server';
      const usersUpdated = loadUsers();
      const uIdx = usersUpdated.findIndex((u) => u.email === email);
      if (uIdx >= 0) {
        usersUpdated[uIdx].onboardingSent = user.onboardingSent;
        usersUpdated[uIdx].onboardingProvider = user.onboardingProvider;
        saveUsers(usersUpdated);
      }
    } catch (e) {
      console.warn('onboarding email failed:', e.message);
    }

    const token = signSession({ email, tier, name, exp: Date.now() + TOKEN_TTL_MS });
    return res.json({
      ok: true,
      emailSent,
      emailProvider,
      onboardingEnrolled,
      onboardingProvider,
      onboardingSequence: ONBOARDING_SEQUENCE.map((e) => ({ day: e.day, subject: e.subject, delayDays: e.delayDays })),
      session: {
        token,
        email,
        tier,
        name,
        trialEnd: trialEndStr,
        trialEndISO: trialEnd.toISOString(),
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' });
    }

    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
    }

    const trialEndDate = user.trialEnd ? new Date(user.trialEnd) : null;
    const trialExpired = trialEndDate ? trialEndDate.getTime() <= Date.now() : false;
    if (trialExpired && !user.paid) {
      return res.status(402).json({
        ok: false,
        error: 'Your 30-day free trial has ended. Add a payment method to restore access.',
        trialExpired: true,
        trialEnd: trialEndDate.toISOString()
      });
    }

    const token = signSession({ email: user.email, tier: user.tier, name: user.name, exp: Date.now() + TOKEN_TTL_MS });
    const trialEnd = trialEndDate
      ? trialEndDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    return res.json({
      ok: true,
      session: {
        token,
        email: user.email,
        tier: user.tier,
        name: user.name,
        trialEnd,
        trialEndISO: user.trialEnd || null,
        createdAt: user.createdAt || null,
        daysLeft: trialEndDate ? Math.max(0, Math.ceil((trialEndDate - Date.now()) / (24 * 60 * 60 * 1000))) : null
      }
    });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: 'Sign in failed. Please try again.' });
  }
});

app.get('/api/session', (req, res) => {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  const session = verifySession(token);
  if (!session) return res.status(401).json({ ok: false, error: 'Session expired. Sign in again.' });
  return res.json({ ok: true, session: { email: session.email, tier: session.tier, name: session.name } });
});

/** Mint a signed API token for Netlify Identity / legacy ni- sessions */
app.post('/api/auth/bridge-session', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const tier = normalizeTier(req.body.tier);
    const name = String(req.body.name || '').trim();
    if (!email) return res.status(400).json({ ok: false, error: 'Email required.' });

    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    const finalTier = user ? user.tier : tier;
    const finalName = (user && user.name) || name || email.split('@')[0];

    const token = signSession({
      email,
      tier: finalTier,
      name: finalName,
      exp: Date.now() + TOKEN_TTL_MS
    });

    return res.json({
      ok: true,
      session: {
        token,
        email,
        tier: finalTier,
        name: finalName,
        trialEndISO: user?.trialEnd || null,
        createdAt: user?.createdAt || null
      }
    });
  } catch (err) {
    console.error('bridge-session error', err);
    return res.status(500).json({ ok: false, error: 'Session bridge failed.' });
  }
});

app.get('/api/onboarding/sequence', (req, res) => {
  return res.json({
    ok: true,
    provider: isBeehiivConfigured() ? 'beehiiv' : 'emailjs_fallback',
    emails: ONBOARDING_SEQUENCE.map((e) => ({
      day: e.day,
      delayDays: e.delayDays,
      delayLabel: e.delayLabel,
      subject: e.subject,
      cta: e.cta
    }))
  });
});

app.get('/api/version', (req, res) => {
  const commit = process.env.RENDER_GIT_COMMIT || process.env.GV_BUILD || 'dev';
  return res.json({
    ok: true,
    build: commit,
    buildShort: String(commit).slice(0, 7),
    uiBuild: 'b3ee89c2',
    features: {
      globalTicker: true,
      bannerAlerts: true,
      onboardingScheduler: true,
      articleSourceValidation: true,
      scoutingTeasers: true
    },
    onboardingDays: ONBOARDING_SEQUENCE.map((e) => e.day)
  });
});

app.post('/api/welcome', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const tier = normalizeTier(req.body.tier);
    if (!email) return res.status(400).json({ ok: false, error: 'Email required.' });
    const welcome = await sendWelcomeEmail({ email, name, tier });
    return res.json({
      ok: true,
      trialEnd: welcome.trialEndStr,
      emailSent: welcome.emailSent,
      provider: welcome.provider
    });
  } catch (err) {
    console.error('welcome error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/trial-status', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Email required.' });
    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    if (!user) return res.status(404).json({ ok: false, error: 'Account not found.' });
    const trialEndDate = user.trialEnd ? new Date(user.trialEnd) : null;
    const daysLeft = trialEndDate ? Math.ceil((trialEndDate - Date.now()) / (24 * 60 * 60 * 1000)) : null;
    return res.json({
      ok: true,
      trialEndISO: user.trialEnd || null,
      daysLeft,
      expired: trialEndDate ? trialEndDate.getTime() <= Date.now() && !user.paid : false,
      paid: !!user.paid
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/digest', async (req, res) => {
  try {
    if (DIGEST_TOKEN) {
      const token = req.get('X-DIGEST-TOKEN') || req.get('x-digest-token');
      if (!token || token !== DIGEST_TOKEN) {
        return res.status(401).json({ ok: false, error: 'Invalid token' });
      }
    }

    const body = req.body || {};
    const summary = body.summary || {};
    const alerts = body.alerts || [];
    const webhookUrl = body.webhookUrl || process.env.DEFAULT_WEBHOOK || null;
    const emailTo = body.emailTo || null;
    const results = { webhook: null, email: null, errors: [] };

    if (webhookUrl) {
      try {
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary, alerts })
        });
        results.webhook = { status: r.status, ok: r.ok };
      } catch (e) {
        results.errors.push('webhook:' + e.message);
      }
    }

    if (emailTo) {
      try {
        const subject = body.subject || 'GatorVault Daily Digest';
        const html = '<div style="font-family:Inter,Arial,sans-serif;color:#e2e8f0;background:#030712;padding:24px;">'
          + '<h2 style="color:#FA4616;margin:0 0 8px;">GatorVault</h2>'
          + '<p style="margin:0 0 16px;color:#94a3b8;">' + (body.subject && body.subject.indexOf('Alert:') !== -1 ? 'New alert from your GatorVault feed.' : 'Your digest summary.') + '</p>'
          + (summary.total ? '<p style="margin:0 0 12px;">Total items: ' + (summary.total || 0) + '</p>' : '')
          + alerts.slice(0, 20).map((a) => '<div style="margin:0 0 12px;padding:12px;background:#0a1628;border-radius:8px;"><strong style="color:#fff;">' + (a.title || a.text) + '</strong>'
            + (a.detail ? '<div style="font-size:13px;color:#94a3b8;margin-top:4px;">' + a.detail + '</div>' : '')
            + '<div style="font-size:12px;color:#64748b;margin-top:4px;">' + (a.time || '') + '</div></div>').join('')
          + '<p style="margin:16px 0 0;font-size:12px;color:#475569;">— GatorVault Team</p></div>';
        await deliverEmail(emailTo, subject, html);
        results.email = { to: emailTo };
      } catch (e) {
        results.errors.push('email:' + e.message);
      }
    }

    return res.json({ ok: true, results });
  } catch (err) {
    console.error('digest error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/email-status', (req, res) => {
  const providers = getEmailProviders();
  const privateKeySet = !!(process.env.EMAILJS_PRIVATE_KEY &&
    process.env.EMAILJS_PRIVATE_KEY !== 'YOUR_PRIVATE_KEY_HERE' &&
    process.env.EMAILJS_PRIVATE_KEY !== 'your-emailjs-private-key-here');
  return res.json({
    ok: true,
    configured: providers.length > 0,
    providers,
    provider: EMAIL_PROVIDER,
    emailjs: {
      publicKey: !!process.env.EMAILJS_PUBLIC_KEY,
      serviceId: process.env.EMAILJS_SERVICE_ID || null,
      templateId: process.env.EMAILJS_TEMPLATE_ID || null,
      privateKeySet,
      replyTo: process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com'
    },
    hint: providers.length === 0
      ? (privateKeySet
        ? 'EmailJS keys present but service/template may be invalid'
        : 'Replace EMAILJS_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE in server/.env with your real EmailJS private key')
      : `Sending via EmailJS (Gmail: ${process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com'})`
  });
});

app.post('/api/test/welcome', async (req, res) => {
  const pin = String(req.body.pin || req.get('X-Test-Pin') || '');
  if (!verifyTestPin(pin)) {
    return res.status(401).json({ ok: false, error: 'Invalid test PIN' });
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || 'Test Member').trim();
  const tier = normalizeTier(req.body.tier);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid test email address.' });
  }
  try {
    const result = await runWelcomeEmailTest({ email, name, tier });
    return res.json(result);
  } catch (err) {
    pushEmailLog({ level: 'error', message: err.message, email, source: 'test-route' });
    return res.status(500).json({ ok: false, error: err.message, emailSent: false });
  }
});

app.get('/api/test/logs', (req, res) => {
  const pin = String(req.query.pin || req.get('X-Test-Pin') || '');
  if (!verifyTestPin(pin)) {
    return res.status(401).json({ ok: false, error: 'Invalid test PIN' });
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));
  return res.json({ ok: true, logs: emailTestLogs.slice(0, limit) });
});

app.get('/api/test/logs/stream', (req, res) => {
  const pin = String(req.query.pin || '');
  if (!verifyTestPin(pin)) {
    return res.status(401).end();
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  let cursor = 0;
  const send = () => {
    const batch = emailTestLogs.slice(0, 50);
    if (batch.length !== cursor) {
      cursor = batch.length;
      res.write(`data: ${JSON.stringify({ logs: batch, ts: Date.now() })}\n\n`);
    }
  };
  send();
  const timer = setInterval(send, 1000);
  req.on('close', () => clearInterval(timer));
});

let _gvLiveSchedulerStarted = false;
function startLiveDashboardScheduler() {
  if (_gvLiveSchedulerStarted) return;
  _gvLiveSchedulerStarted = true;
  const { refreshLiveDashboard } = require('./lib/live-aggregator');
  const intervalMs = Math.max(60000, parseInt(process.env.LIVE_POLL_INTERVAL_MS || '180000', 10) || 180000); // default 3 min
  const bootDelay = Math.max(8000, parseInt(process.env.LIVE_POLL_BOOT_DELAY_MS || '20000', 10) || 20000);
  const tick = () => {
    refreshLiveDashboard()
      .then((result) => {
        const beatErr = result?.beat?.error;
        if (beatErr) console.warn('[live-dashboard] beat:', beatErr);
        else console.log('[live-dashboard] refreshed');
      })
      .catch((err) => console.warn('[live-dashboard]', err.message));
  };
  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Live dashboard: polling every', Math.round(intervalMs / 1000), 's');
}

let _gvIngestSchedulerStarted = false;
function startOn3IngestScheduler() {
  if (process.env.ON3_INGEST_ENABLED !== 'true') return;
  if (_gvIngestSchedulerStarted) return;
  _gvIngestSchedulerStarted = true;
  const { runOn3Ingest } = require('./lib/on3-ingest');
  const intervalMs = Math.max(60000, parseInt(process.env.ON3_INGEST_INTERVAL_MS || '120000', 10) || 120000);
  const bootDelay = Math.max(5000, parseInt(process.env.ON3_INGEST_BOOT_DELAY_MS || '15000', 10) || 15000);

  const tick = () => {
    runOn3Ingest()
      .then((r) => {
        if (r.fired && r.fired.length) {
          console.log('[on3-ingest] fired', r.fired.length, 'event(s)');
        }
      })
      .catch((err) => console.warn('[on3-ingest]', err.message));
  };

  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('On3 ingest: enabled (every', Math.round(intervalMs / 1000), 's)');
}

app.use(express.static(__dirname));

app.listen(PORT, () => {
  const providers = getEmailProviders();
  console.log('GatorVault server running on port', PORT);
  try {
    const store = require('./lib/recruiting-store');
    console.log('Recruiting API: ready (storage:', store.storageMode() + ')');
  } catch (e) {
    console.warn('Recruiting API: failed to init', e.message);
  }
  try {
    ensurePublishedSeed();
    console.log('Content API: ready (accuracy validation + review queue)');
  } catch (e) {
    console.warn('Content API: failed to init', e.message);
  }
  try {
    if (process.env.COMMUNITY_SEED_ENABLED === 'true' && !communityStore.isSeeded()) {
      require('./scripts/seed-community');
    }
    console.log('Community API: ready (' + communityStore.loadThreads().filter((t) => !t.deleted).length + ' threads)');
  } catch (e) {
    console.warn('Community API: failed to init', e.message);
  }
  try {
    startOn3IngestScheduler();
  } catch (e) {
    console.warn('On3 ingest scheduler failed to start', e.message);
  }
  try {
    const { validateXBearerToken } = require('./lib/live-beat');
    validateXBearerToken()
      .then((s) => {
        if (s.ok) console.log('[live-dashboard] Beat stream: X_BEARER_TOKEN validated');
        else console.warn('[live-dashboard] Beat stream:', s.error);
      })
      .catch((err) => console.warn('[live-dashboard] Beat token check failed', err.message));
    startLiveDashboardScheduler();
  } catch (e) {
    console.warn('Live dashboard scheduler failed to start', e.message);
  }
  try {
    validateBeehiivOnBoot();
  } catch (e) {
    console.warn('Beehiiv onboarding check failed', e.message);
  }
  try {
    startOnboardingScheduler({ loadUsers, saveUsers, deliverEmail, pushEmailLog });
  } catch (e) {
    console.warn('Onboarding email scheduler failed to start', e.message);
  }
  if (providers.length) {
    console.log('Email delivery: configured (' + providers.join(', ') + ')');
  } else {
    console.warn('Email delivery: NOT configured — welcome emails will not send from server.');
    console.warn('  Fix: copy server/.env.example to server/.env and set EmailJS or SMTP (see README).');
  }
});
