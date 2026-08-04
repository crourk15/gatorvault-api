require('dotenv').config();
const { applyToProcessEnv } = require('./lib/autoposter/uf-premium-mode');
applyToProcessEnv();
const express = require('express');
const bodyParser = require('body-parser');
const { mountRecruitingRoutes } = require('./lib/recruiting-routes');
const { mountContentRoutes } = require('./lib/content-routes');
const { mountCommunityRoutes } = require('./lib/community-routes');
const { mountRosterRoutes } = require('./lib/roster-routes');
const { mountLiveRoutes } = require('./lib/live-routes');
const { mountVaultDashboardRoutes } = require('./lib/vault-dashboard-routes');
const { mountHighlightsRoutes } = require('./lib/highlights-routes');
const { mountInterviewsRoutes } = require('./lib/interviews-routes');
const { mountMediaIngestRoutes } = require('./lib/media-ingest-routes');
const { mountWarRoomRoutes } = require('./lib/war-room-routes');
const { mountPlatformRoutes } = require('./lib/platform-routes');
const pointsStore = require('./lib/points-store');
const accessConfig = require('./lib/access-config');
const { mountXAutoposterRoutes } = require('./lib/x-autoposter-routes');
const { mountMonitoringRoutes } = require('./lib/monitoring-routes');
const { mountAdminRoutes } = require('./lib/admin-routes');
const { mountAdminHubRoutes } = require('./lib/admin-hub-routes');
const { mountFilmRoomKnowledgeRoutes } = require('./lib/film-room-knowledge-routes');
const { mountNilRoutes } = require('./lib/nil-routes');
const { mountOpsRoutes } = require('./lib/ops-routes');
const { mountTeamStaffRoutes } = require('./lib/team-staff-routes');
const { mountQaRoutes } = require('./lib/qa-routes');
const { mountProductIntelRoutes } = require('./lib/product-intel/product-intel-routes');
const { mountUnresolvedPredictionsRoutes } = require('./lib/unresolved-predictions-routes');
const { mountGm2Routes } = require('./lib/gm2/gm2-routes');
const { mountVaultGradeAdminRoutes } = require('./lib/vault-grade-admin-routes');
const { mountPlayerIntelEntryRoutes } = require('./lib/player-intel-entry-routes');
const { apiMonitorMiddleware } = require('./lib/api-monitor');
const { ensurePublishedSeed, auditPublishedArticles } = require('./lib/content-store');
const communityStore = require('./lib/community-store');
const { effectiveTier, isAdminAccount, isReservedOperatorEmail } = require('./lib/session-auth');
const { loadUsers, saveUsers, findUserByEmail } = require('./lib/user-store');
const { hasPaidAccess, buildSessionFields } = require('./lib/subscription-service');
const { mountSubscriptionRoutes } = require('./lib/subscription-routes');
const { mountPushAlertRoutes } = require('./lib/push-alert-routes');
const { mountAlertEmailRoutes } = require('./lib/alert-email-routes');
const { mountAccountRoutes } = require('./lib/account-routes');
const pipelineGuards = require('./lib/pipeline-guards');

const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

/** Liveness probe — register before middleware so Render /health never blocks on JSON parsing. */
require('./lib/health')(app);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    'https://gatorvaultinsider.com',
    'https://www.gatorvaultinsider.com',
    'https://gatorvault.com',
    'https://www.gatorvault.com',
    'https://futurecast.gatorvault.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  const isNetlifyPreview = origin && /\.netlify\.app$/i.test(origin);
  const isCapacitorNative =
    origin &&
    (origin === 'capacitor://localhost' ||
      origin === 'ionic://localhost' ||
      origin === 'https://localhost' ||
      origin === 'http://localhost');
  if (origin && (allowed.includes(origin) || isNetlifyPreview || isCapacitorNative)) {
    // Credentialed fetches from the Capacitor WebView (Community, session cookie/Bearer)
    // require a reflected Origin + Allow-Credentials — '*' is rejected by the browser.
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Recruiting-Pin, X-Roster-Pin, X-Ingest-Secret, X-Content-Pin, X-Community-Pin, X-Live-Pin, X-Live-Cron, X-War-Room-Pin, X-X-Autopost-Pin, X-X-Cron, X-Media-Ingest-Pin, X-Monitoring-Secret, X-Monitoring-Cron, X-Ops-Pin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(
  bodyParser.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      // Stripe webhooks need the raw body for signature verification.
      if (req.originalUrl && req.originalUrl.includes('/subscription/stripe/webhook')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(require('./lib/api-cache-policy').apiCacheMiddleware());
app.use(apiMonitorMiddleware());

const PORT = process.env.PORT || 3000;
let apiRoutesReady = false;

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now(), ready: apiRoutesReady });
});

app.use('/api', (req, res, next) => {
  if (!apiRoutesReady && req.path !== '/ping') {
    res.set('Retry-After', '5');
    res.set('Cache-Control', 'no-store, must-revalidate');
    return res.status(503).json({ ok: false, error: 'API warming up', unavailable: true });
  }
  next();
});

app.listen(PORT, () => {
  console.log('[boot] early listen on port', PORT);
  // Keep /health green through Render's deploy probes before sync route wiring.
  // Starter CPUs can spend multiple seconds inside wireApplication mounts.
  const parsedWire = parseInt(process.env.API_WIRE_DELAY_MS || '10000', 10);
  const wireDelay = Number.isFinite(parsedWire) ? Math.max(0, parsedWire) : 10000;
  console.log('[boot] deferring route wiring', wireDelay, 'ms');
  setTimeout(() => setImmediate(wireApplication), wireDelay);
});

function wireApplication() {
  // Mount routes in small yielded steps so Render /health can answer between them.
  const steps = [
    function stepStaticHtml() {
      app.get('/highlight/:slug', (req, res) => {
        res.sendFile(path.join(__dirname, 'highlight.html'));
      });
      app.get('/futurecast/big-board', (req, res) => {
        res.sendFile(path.join(__dirname, 'futurecast-big-board.html'));
      });
      app.get('/futurecast-big-board.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'futurecast-big-board.html'));
      });
      app.get('/futurecast/player/:slug', (req, res) => {
        res.redirect(301, `/player/${encodeURIComponent(req.params.slug)}`);
      });
      app.get('/futurecast/portal-watchlist', (req, res) => {
        res.sendFile(path.join(__dirname, 'futurecast-portal-watchlist.html'));
      });
      app.get('/futurecast/uf-fit-watchlist', (req, res) => {
        res.sendFile(path.join(__dirname, 'futurecast-uf-fit-watchlist.html'));
      });
      app.get('/futurecast/predictions', (req, res) => {
        res.redirect(301, '/futurecast');
      });
      app.get('/futurecast/predictors', (req, res) => {
        res.redirect(301, '/futurecast');
      });
    },
    function stepFutureCastUi() {
      const { mountFutureCastUiRoutes } = require('./lib/futurecast-ui-routes');
      mountFutureCastUiRoutes(app);
    },
    function stepCoreContent() {
      mountRecruitingRoutes(app);
      mountContentRoutes(app);
      mountCommunityRoutes(app);
      mountRosterRoutes(app);
    },
    function stepLiveMedia() {
      mountLiveRoutes(app);
      mountVaultDashboardRoutes(app);
      mountHighlightsRoutes(app);
      mountInterviewsRoutes(app);
      mountMediaIngestRoutes(app);
    },
    function stepWarPlatform() {
      mountWarRoomRoutes(app);
      mountPlatformRoutes(app);
    },
    function stepAccountSubs() {
      global.__GV_SUBSCRIPTION_MAIL__ = global.__GV_SUBSCRIPTION_MAIL__ || {
        deliverEmail: async (...args) => {
          if (typeof global.__GV_SUBSCRIPTION_MAIL__._impl !== 'function') {
            return { sent: false, provider: null, error: 'Email deliverer not ready' };
          }
          return global.__GV_SUBSCRIPTION_MAIL__._impl(...args);
        },
        _impl: null,
      };
      mountSubscriptionRoutes(app, {
        deliverEmail: (...args) => global.__GV_SUBSCRIPTION_MAIL__.deliverEmail(...args)
      });
      mountPushAlertRoutes(app);
      mountAlertEmailRoutes(app);
      mountAccountRoutes(app);
    },
    function stepAdmin() {
      mountXAutoposterRoutes(app);
      mountMonitoringRoutes(app);
      mountAdminRoutes(app);
      mountAdminHubRoutes(app);
      try {
        require('tsx/cjs');
        const { mountAdminEngineRoutes } = require('./api/v1/admin/run-engines.ts');
        mountAdminEngineRoutes(app);
      } catch (err) {
        console.warn('[admin-engines] not mounted:', err.message);
      }
    },
    function stepOpsQa() {
      mountFilmRoomKnowledgeRoutes(app);
      mountNilRoutes(app);
      mountOpsRoutes(app);
      mountTeamStaffRoutes(app);
      require('./lib/ops-restart')(app);
      require('./lib/redeploy')(app);
      mountQaRoutes(app);
      mountProductIntelRoutes(app);
      mountUnresolvedPredictionsRoutes(app);
    },
    function stepIntelGm2() {
      const { mountSelfRunnerRoutes } = require('./lib/self-runner/self-runner-routes');
      mountSelfRunnerRoutes(app);
      mountGm2Routes(app);
      require('./lib/insider-articles-routes').mountInsiderArticlesRoutes(app);
      require('./lib/insider-hub-routes').mountInsiderHubRoutes(app);
      require('./lib/insider-analytics-engine').mountAnalyticsRoutes(app);
      mountVaultGradeAdminRoutes(app);
      mountPlayerIntelEntryRoutes(app);
      try {
        require('./lib/futurecast-players-routes').mountFutureCastPlayersRoutes(app);
      } catch (err) {
        console.warn('[futurecast] Players API not mounted:', err.message);
      }
    }
  ];
  let i = 0;
  function next() {
    if (i >= steps.length) {
      console.log('[boot] route mounts complete — wiring auth/services');
      wireApplicationRest();
      return;
    }
    const step = steps[i++];
    try {
      step();
    } catch (err) {
      console.warn('[boot] wire step failed:', step.name || i, err && err.message ? err.message : err);
    }
    setImmediate(next);
  }
  next();
}

function wireApplicationRest() {
  // subscriptionMail bridge used by deliverEmail wiring below
  const subscriptionMail = global.__GV_SUBSCRIPTION_MAIL__ || {
    deliverEmail: async () => ({ sent: false, provider: null, error: 'Email deliverer not ready' }),
    _impl: null
  };

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

const {
  getEmailJsPublicKey,
  getEmailJsPrivateKey,
  getEmailJsConfig,
  isEmailJsReady,
  getEmailJsPublicKeyHint
} = require('./lib/emailjs-config');
const { isResendReady, sendEmailViaResend, getResendFrom } = require('./lib/resend-server');

function getEmailProviders() {
  const providers = [];
  // Prefer raw-HTML providers so onboarding/drip is not blocked on EmailJS template Save.
  if (isResendReady()) providers.push('resend');
  if (process.env.SENDGRID_API_KEY) providers.push('sendgrid');
  if (process.env.SMTP_HOST) providers.push('smtp');
  if (isEmailJsReady()) providers.push('emailjs');
  if (EMAIL_PROVIDER === 'emailjs' && providers.length === 0 && isEmailJsReady()) {
    return ['emailjs'];
  }
  return providers;
}

async function sendEmailEmailJS(to, templateParams) {
  const { sendEmailViaEmailJS } = require('./lib/emailjs-server');
  const {
    getTierLabel,
    getTierBenefitsHtml,
    VAULT_URL,
    VAULT_LINK_LABEL,
    VAULT_URL_DISPLAY,
  } = require('./lib/onboarding-emails');
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
  if (!isEmailJsReady()) {
    throw new Error('EmailJS not configured — set EMAILJS_USER_ID (public key), EMAILJS_PRIVATE_KEY, service and template IDs');
  }

  const tierKey = templateParams.tier || templateParams.tierName || 'film';
  const tierLabel = getTierLabel(tierKey);
  const displayName = templateParams.name || to.split('@')[0];

  const params = {
    to_email: to,
    name: displayName,
    email: to,
    tier: tierLabel,
    tier_benefits: templateParams.tierBenefits || getTierBenefitsHtml(tierKey),
    body_html: templateParams.bodyHtml || templateParams.body_html || templateParams.html || templateParams.tierBenefits || getTierBenefitsHtml(tierKey),
    vault_url: templateParams.vault_url || VAULT_URL,
    vault_link_label: templateParams.vault_link_label || VAULT_LINK_LABEL,
    vault_url_display: VAULT_URL_DISPLAY,
    support_email: process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com',
    email_subject: templateParams.emailSubject || templateParams.subject || 'Welcome to GatorVault — Your Insider Access Is Live',
    reply_to: process.env.EMAILJS_REPLY_TO || process.env.SMTP_USER || 'support@gatorvaultinsider.com'
  };

  return sendEmailViaEmailJS({ serviceId, templateId, publicKey, templateParams: params, privateKey });
}

async function deliverEmail(to, subject, html, templateParams = {}) {
  const params = { ...templateParams, html, emailSubject: subject, subject };
  const forceProvider = String(templateParams.forceProvider || process.env.EMAIL_FORCE_PROVIDER || '').toLowerCase();
  const preferRawHtml = templateParams.preferRawHtml !== false; // default true — elite drip needs real subjects/HTML

  const tryResend = async () => {
    await sendEmailViaResend({ to, subject, html });
    pushEmailLog({ level: 'success', message: 'Resend send OK', detail: { to, subject }, source: 'deliver' });
    return { sent: true, provider: 'resend' };
  };
  const trySendGrid = async () => {
    await sendEmailSendGrid(to, subject, html);
    pushEmailLog({ level: 'success', message: 'SendGrid send OK', detail: { to, subject }, source: 'deliver' });
    return { sent: true, provider: 'sendgrid' };
  };
  const trySmtp = async () => {
    await sendEmailSMTP(to, subject, html);
    pushEmailLog({ level: 'success', message: 'SMTP send OK', detail: { to, subject }, source: 'deliver' });
    return { sent: true, provider: 'smtp' };
  };
  const tryEmailJs = async () => {
    if (!isEmailJsReady()) {
      const msg = 'EmailJS private key missing or placeholder in server/.env';
      pushEmailLog({ level: 'error', message: msg, detail: { to }, source: 'deliver' });
      return { sent: false, provider: null, error: msg };
    }
    await sendEmailEmailJS(to, params);
    pushEmailLog({ level: 'success', message: 'EmailJS send OK', detail: { to, subject }, source: 'deliver' });
    return { sent: true, provider: 'emailjs' };
  };

  // Forced provider for ops/tests.
  if (forceProvider === 'resend') return tryResend();
  if (forceProvider === 'sendgrid') return trySendGrid();
  if (forceProvider === 'smtp') return trySmtp();
  if (forceProvider === 'emailjs') return tryEmailJs();

  const attempts = [];

  // Raw HTML first when available — bypasses EmailJS template Save outages.
  if (preferRawHtml) {
    if (isResendReady()) {
      try {
        const result = await tryResend();
        return { ...result, attempts: [...attempts, { provider: 'resend', ok: true }] };
      } catch (err) {
        attempts.push({ provider: 'resend', ok: false, error: err.message });
        pushEmailLog({ level: 'error', message: err.message, detail: { to, subject, provider: 'resend' }, source: 'deliver' });
        // fall through to other providers
      }
    }
    if (process.env.SENDGRID_API_KEY) {
      try {
        const result = await trySendGrid();
        return { ...result, attempts: [...attempts, { provider: 'sendgrid', ok: true }] };
      } catch (err) {
        attempts.push({ provider: 'sendgrid', ok: false, error: err.message });
        pushEmailLog({ level: 'error', message: err.message, detail: { to, subject, provider: 'sendgrid' }, source: 'deliver' });
      }
    }
    if (process.env.SMTP_HOST) {
      try {
        const result = await trySmtp();
        return { ...result, attempts: [...attempts, { provider: 'smtp', ok: true }] };
      } catch (err) {
        attempts.push({ provider: 'smtp', ok: false, error: err.message });
        pushEmailLog({ level: 'error', message: err.message, detail: { to, subject, provider: 'smtp' }, source: 'deliver' });
      }
    }
  }

  // Legacy EmailJS template path (welcome/drip still work once template Save succeeds).
  if (EMAIL_PROVIDER === 'emailjs' || isEmailJsReady()) {
    try {
      const result = await tryEmailJs();
      return {
        ...result,
        attempts: [...attempts, { provider: 'emailjs', ok: Boolean(result.sent) }],
        fallbackFrom: attempts.find((a) => !a.ok)?.provider || null,
        resendError: attempts.find((a) => a.provider === 'resend' && !a.ok)?.error || null,
      };
    } catch (err) {
      pushEmailLog({ level: 'error', message: err.message, detail: { to, subject }, source: 'deliver' });
      throw err;
    }
  }

  const msg = 'No email provider configured — set RESEND_API_KEY (recommended) or EmailJS keys';
  pushEmailLog({ level: 'error', message: msg, detail: { to }, source: 'deliver' });
  return { sent: false, provider: null, error: msg, attempts };
}

subscriptionMail._impl = deliverEmail;

const { getWelcomeEmail, ONBOARDING_SEQUENCE } = require('./lib/onboarding-emails');
const { startOnboardingScheduler } = require('./lib/onboarding-scheduler');

async function sendWelcomeEmail({ email, name, tier, trialEndISO = null }) {
  const trialEnd = trialEndISO ? new Date(trialEndISO) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const trialEndStr = Number.isFinite(trialEnd.getTime())
    ? trialEnd.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const welcome = getWelcomeEmail({ name, email, tier, trialEndStr });
  const delivery = await deliverEmail(email, welcome.subject, welcome.html, {
    name: welcome.templateParams.name,
    tier: tier,
    tierName: welcome.tier,
    tierBenefits: welcome.templateParams.tier_benefits,
    bodyHtml: welcome.templateParams.body_html,
    emailSubject: welcome.subject,
    html: welcome.html,
    vault_url: welcome.templateParams.vault_url,
    vault_link_label: welcome.templateParams.vault_link_label,
  });
  return {
    trialEndStr,
    emailSent: delivery.sent,
    provider: delivery.provider,
    error: delivery.error || null,
    resendError: delivery.resendError || null,
    fallbackFrom: delivery.fallbackFrom || null,
    attempts: delivery.attempts || null,
  };
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
    userIdSet: !!getEmailJsPublicKey(),
    publicKeyHint: getEmailJsPublicKeyHint(),
    privateKeySet: !!getEmailJsPrivateKey()
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
      add('success', 'Welcome email sent via EmailJS', {
        provider: welcome.provider,
        trialEnd: welcome.trialEndStr,
        emailJsContacted: true
      });
      return { ok: true, emailSent: true, provider: welcome.provider, trialEnd: welcome.trialEndStr, emailJsContacted: true, steps };
    }
    add('error', 'Email was not sent', {
      error: welcome.error,
      emailJsContacted: false,
      hint: 'EmailJS was never called — check EMAILJS_USER_ID, EMAILJS_PRIVATE_KEY, service and template IDs on Render'
    });
    return { ok: false, emailSent: false, error: welcome.error || 'Delivery returned sent:false', emailJsContacted: false, steps };
  } catch (err) {
    add('error', err.message, {
      emailJsContacted: !/not configured/i.test(err.message),
      hint: err.message.includes('404') || err.message.includes('Account not found')
        ? 'Update Render env: EMAILJS_USER_ID and EMAILJS_PRIVATE_KEY must both be from the same EmailJS account (Account → API keys)'
        : 'Check EmailJS template variables and Gmail service connection'
    });
    return { ok: false, emailSent: false, error: err.message, emailJsContacted: true, steps };
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim();
    // Self-register never chooses War — upgrades only via IAP / admin grant.
    const tier = 'locker';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
    }
    if (isReservedOperatorEmail(email)) {
      return res.status(403).json({
        ok: false,
        error: 'This email cannot self-register. Contact support@gatorvaultinsider.com for operator access.',
        code: 'reserved_email',
      });
    }

    const users = loadUsers();
    if (users.find((u) => u.email === email)) {
      return res.status(409).json({
        ok: false,
        error: 'An account with this email already exists. Sign in instead.',
        code: 'email_taken',
      });
    }

    const { resolveRegistrationTrial, rememberTrial } = require('./lib/trial-ledger');
    const trialPlan = resolveRegistrationTrial(email, { trialDays: 30 });
    const trialEnd = trialPlan.trialEnd;
    const createdAt = new Date().toISOString();

    const user = {
      email,
      name,
      tier,
      passwordHash: hashPassword(password),
      createdAt: trialPlan.trialStart || createdAt,
      trialEnd: trialEnd.toISOString(),
    };
    users.push(user);
    saveUsers(users);
    rememberTrial(email, {
      trialEnd: user.trialEnd,
      trialStart: user.createdAt,
      createdAt: user.createdAt,
    });

    let trialEndStr = trialEnd.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    let emailSent = false;
    let emailProvider = null;
    let beehiivEnroll = { enrolled: false, provider: null };
    try {
      const welcome = await sendWelcomeEmail({
        email,
        name,
        tier,
        trialEndISO: user.trialEnd,
      });
      trialEndStr = welcome.trialEndStr;
      emailSent = welcome.emailSent;
      emailProvider = welcome.provider;
      if (!emailSent) {
        console.warn('welcome email not delivered for', email, '— check EmailJS in .env');
      }
      user.onboardingSent = welcome.emailSent ? [0] : [];
      user.onboardingProvider = 'server';
      user.trialRemindersSent = [];
      try {
        const { enrollOnboarding } = require('./lib/beehiiv');
        beehiivEnroll = await enrollOnboarding({ email, name, tier });
        if (beehiivEnroll.enrolled) {
          user.beehiivSubscriptionId = beehiivEnroll.subscriptionId || null;
        }
      } catch (beehiivErr) {
        console.warn('beehiiv enroll skipped:', beehiivErr.message);
      }
      const usersUpdated = loadUsers();
      const uIdx = usersUpdated.findIndex((u) => u.email === email);
      if (uIdx >= 0) {
        usersUpdated[uIdx].onboardingSent = user.onboardingSent;
        usersUpdated[uIdx].onboardingProvider = user.onboardingProvider;
        usersUpdated[uIdx].trialRemindersSent = user.trialRemindersSent;
        if (user.beehiivSubscriptionId) {
          usersUpdated[uIdx].beehiivSubscriptionId = user.beehiivSubscriptionId;
        }
        saveUsers(usersUpdated);
      }
    } catch (e) {
      console.warn('welcome email failed:', e.message);
    }

    const token = signSession({ email, tier, name, exp: Date.now() + TOKEN_TTL_MS });
    const sessionFields = buildSessionFields(user, pointsStore);
    return res.json({
      ok: true,
      emailSent,
      emailProvider,
      onboardingEnrolled: true,
      onboardingProvider: 'server',
      onboardingMode: 'drip',
      beehiivEnrolled: Boolean(beehiivEnroll.enrolled),
      welcomeEmail: ONBOARDING_SEQUENCE[0],
      onboardingDays: ONBOARDING_SEQUENCE.map((e) => e.day),
      trialReused: Boolean(trialPlan.reused),
      trialExpired: Boolean(sessionFields.accessActive === false && !sessionFields.paid),
      session: {
        token,
        ...sessionFields,
      },
    });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { requestPasswordReset } = require('./lib/password-reset');
    const email = String(req.body?.email || '').trim().toLowerCase();
    await requestPasswordReset(email, { deliverEmail });
    // Always identical body — do not reveal whether the account exists.
    return res.json({
      ok: true,
      accepted: true,
      message:
        'If that email has a GatorVault account, we sent a password reset link. Check your inbox (and spam).',
    });
  } catch (err) {
    console.error('forgot-password error', err);
    return res.status(500).json({ ok: false, error: 'Could not process password reset.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { resetPasswordWithToken } = require('./lib/password-reset');
    const result = resetPasswordWithToken({
      email: req.body?.email,
      token: req.body?.token,
      password: req.body?.password,
    });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error || 'Reset failed.' });
    }
    return res.json({
      ok: true,
      email: result.email,
      message: 'Password updated. Sign in with your new password.',
    });
  } catch (err) {
    console.error('reset-password error', err);
    return res.status(500).json({ ok: false, error: 'Could not reset password.' });
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
    if (!user) {
      // Distinct from wrong-password so members orphaned by ephemeral disk wipes
      // can tell "account missing" apart from a typo — still safe (no password hint).
      return res.status(401).json({
        ok: false,
        code: 'account_not_found',
        error:
          'No account found for that email. Create an account first (or re-create it if you signed up before accounts were persisted).',
      });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ ok: false, code: 'bad_password', error: 'Incorrect email or password.' });
    }

    // Always issue a session after password check so expired-trial members can open
    // Membership / restore / subscribe. Vault content stays gated by accessActive.
    const token = signSession({
      email: user.email,
      tier: user.tier,
      name: user.name,
      exp: Date.now() + TOKEN_TTL_MS,
    });
    const sessionFields = buildSessionFields(user, pointsStore);
    const trialExpired = Boolean(sessionFields.membershipRequired);
    return res.json({
      ok: true,
      trialExpired,
      membershipRequired: trialExpired,
      membershipUrl: trialExpired ? `${SITE_URL}/vault/membership/?trial=ended` : null,
      session: {
        token,
        ...sessionFields,
      },
    });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: 'Sign in failed. Please try again.' });
  }
});

const { verifyAdminPin } = require('./lib/admin-pin');

/** Operator PIN login — War Room full access from landing page Admin Access footer. */
app.post('/api/operator/login', (req, res) => {
  try {
    const pin = String(req.body.pin || '').trim();
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN.' });
    }
    const email = 'operator@gatorvault';
    const token = signSession({ email, tier: 'war', name: 'Operator', exp: Date.now() + TOKEN_TTL_MS });
    return res.json({
      ok: true,
      session: {
        token,
        email,
        tier: 'war',
        name: 'Operator',
        trialEnd: null,
        trialEndISO: null,
        createdAt: new Date().toISOString(),
        daysLeft: null
      }
    });
  } catch (err) {
    console.error('operator login error', err);
    return res.status(500).json({ ok: false, error: 'Operator login failed.' });
  }
});

app.get('/api/session', (req, res) => {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  const session = verifySession(token);
  if (!session) return res.status(401).json({ ok: false, error: 'Session expired. Sign in again.' });
  const user = findUserByEmail(session.email);
  if (!user) {
    return res.status(401).json({ ok: false, error: "Account not found. Sign in again." });
  }
  return res.json({
    ok: true,
    session: buildSessionFields(user, pointsStore),
  });
});

/** Legacy Netlify Identity bridge — disabled unless explicitly enabled with a shared secret. */
app.post('/api/auth/bridge-session', (req, res) => {
  const expected = String(process.env.AUTH_BRIDGE_SECRET || '').trim();
  const provided = String(req.get('X-Auth-Bridge-Secret') || req.body?.secret || '').trim();
  if (!expected || !provided || provided !== expected) {
    return res.status(403).json({ ok: false, error: 'Session bridge is disabled.' });
  }
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const tier = normalizeTier(req.body.tier);
    const name = String(req.body.name || '').trim();
    if (!email) return res.status(400).json({ ok: false, error: 'Email required.' });

    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Account not found.' });
    }
    const finalTier = user.tier || tier;
    const finalName = user.name || name || email.split('@')[0];

    const token = signSession({
      email,
      tier: finalTier,
      name: finalName,
      exp: Date.now() + TOKEN_TTL_MS
    });
    const sessionFields = buildSessionFields(user, pointsStore);
    const trialExpired = Boolean(sessionFields.membershipRequired);

    return res.json({
      ok: true,
      trialExpired,
      membershipRequired: trialExpired,
      membershipUrl: trialExpired ? `${SITE_URL}/vault/membership/?trial=ended` : null,
      session: {
        token,
        ...sessionFields,
      }
    });
  } catch (err) {
    console.error('bridge-session error', err);
    return res.status(500).json({ ok: false, error: 'Session bridge failed.' });
  }
});

app.get('/api/onboarding/sequence', (req, res) => {
  const { TRIAL_REMINDER_SEQUENCE } = require('./lib/onboarding-emails');
  return res.json({
    ok: true,
    mode: 'drip',
    provider: 'emailjs',
    emails: ONBOARDING_SEQUENCE.map((e) => ({
      day: e.day,
      delayDays: e.delayDays,
      delayLabel: e.delayLabel,
      subject: e.subject,
      kind: e.kind,
    })),
    trialReminders: TRIAL_REMINDER_SEQUENCE.map((e) => ({
      key: e.key,
      daysLeft: e.daysLeft,
      subject: e.subject,
      kind: e.kind,
    })),
  });
});

app.post('/api/onboarding/process', async (req, res) => {
  try {
    const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
    const header = String(req.get('x-monitoring-cron') || req.get('x-cron-secret') || '');
    if (!cronSecret || header !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { processOnboardingQueue } = require('./lib/onboarding-scheduler');
    const { hasPaidAccess } = require('./lib/subscription-service');
    const result = await processOnboardingQueue({
      loadUsers,
      saveUsers,
      deliverEmail,
      hasPaidAccess,
      pushEmailLog,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('onboarding process error', err);
    return res.status(500).json({ ok: false, error: err.message || 'Onboarding process failed' });
  }
});

app.post('/api/fan-digest/weekly', async (req, res) => {
  try {
    const cronSecret = process.env.MONITORING_CRON_SECRET || process.env.CRON_SECRET || '';
    const header = String(req.get('x-monitoring-cron') || req.get('x-cron-secret') || '');
    if (!cronSecret || header !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { processFanDigestWeekly, digestEnabled } = require('./lib/fan-digest');
    const dryRun = Boolean(req.body?.dryRun);
    const force = Boolean(req.body?.force);
    const result = await processFanDigestWeekly({
      loadUsers,
      saveUsers,
      deliverEmail,
      dryRun,
      force,
    });
    return res.json({ ok: true, enabled: digestEnabled(), ...result });
  } catch (err) {
    console.error('fan digest weekly error', err);
    return res.status(500).json({ ok: false, error: err.message || 'Fan digest failed' });
  }
});

app.get('/api/version', (req, res) => {
  const commit = process.env.RENDER_GIT_COMMIT || process.env.GV_BUILD || 'dev';
  const { shouldUseServerScheduler } = require('./lib/onboarding-scheduler');
  const { digestEnabled } = require('./lib/fan-digest');
  return res.json({
    ok: true,
    build: commit,
    buildShort: String(commit).slice(0, 7),
    uiBuild: String(commit).slice(0, 7),
    features: {
      globalTicker: true,
      bannerAlerts: true,
      onboardingScheduler: shouldUseServerScheduler(),
      welcomeEmailOnly: false,
      onboardingDrip: true,
      trialConvertEmails: true,
      paidMembershipConfirmEmail: true,
      weeklyFanDigest: digestEnabled(),
      passwordResetEmail: true,
      webCheckout: (() => {
        try {
          return require('./lib/stripe-checkout').isWebCheckoutEnabled();
        } catch {
          return false;
        }
      })(),
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
      provider: welcome.provider,
      resendError: welcome.resendError || null,
      fallbackFrom: welcome.fallbackFrom || null,
      attempts: welcome.attempts || null,
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
      expired: trialEndDate ? trialEndDate.getTime() <= Date.now() && !hasPaidAccess(user) : false,
      paid: hasPaidAccess(user)
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

app.get('/api/email-status', async (req, res) => {
  const providers = getEmailProviders();
  const privateKeySet = !!getEmailJsPrivateKey();
  const publicKey = getEmailJsPublicKey();
  let probe = null;
  if (req.query.probe === '1' && isEmailJsReady()) {
    const { probeEmailJsAccount } = require('./lib/emailjs-server');
    probe = await probeEmailJsAccount();
  }
  const primary = providers[0] || null;
  return res.json({
    ok: true,
    configured: providers.length > 0,
    providers,
    provider: primary || EMAIL_PROVIDER,
    preferredProvider: primary,
    resend: {
      ready: isResendReady(),
      from: isResendReady() ? getResendFrom() : null,
      endpoint: 'https://api.resend.com/emails',
    },
    emailjs: {
      sender: 'lib/emailjs-server.js',
      endpoint: 'https://api.emailjs.com/api/v1.0/email/send',
      build: process.env.RENDER_GIT_COMMIT ? String(process.env.RENDER_GIT_COMMIT).slice(0, 7) : null,
      mode: 'server-rest',
      restPayloadKeys: ['service_id', 'template_id', 'user_id', 'accessToken', 'template_params'],
      templateParamKeys: ['to_email', 'name', 'email', 'tier', 'tier_benefits', 'body_html', 'vault_url', 'support_email', 'email_subject'],
      serviceId: getEmailJsConfig().serviceId || null,
      templateId: getEmailJsConfig().templateId || null,
      userIdSet: !!publicKey,
      publicKeyHint: getEmailJsPublicKeyHint(),
      privateKeySet,
      privateKeyLen: getEmailJsPrivateKey().length || 0,
      replyTo: process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com',
      probe: probe || undefined
    },
    hint: providers.length === 0
      ? 'Set RESEND_API_KEY (recommended for drip) or EmailJS keys'
      : primary === 'resend'
        ? `Sending via Resend (${getResendFrom()}) — EmailJS template Save not required`
        : primary === 'emailjs'
          ? `Sending via EmailJS (Gmail: ${process.env.EMAILJS_REPLY_TO || 'gatorvaultinsider@gmail.com'})`
          : `Sending via ${primary}`
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
    const status = result.ok ? 200 : (result.emailJsContacted ? 502 : 503);
    return res.status(status).json(result);
  } catch (err) {
    pushEmailLog({ level: 'error', message: err.message, email, source: 'test-route' });
    return res.status(500).json({ ok: false, error: err.message, emailSent: false });
  }
});

app.post('/api/test/onboarding-day', async (req, res) => {
  const pin = String(req.body.pin || req.get('X-Test-Pin') || '');
  if (!verifyTestPin(pin)) {
    return res.status(401).json({ ok: false, error: 'Invalid test PIN' });
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || 'Test Member').trim();
  const tier = normalizeTier(req.body.tier);
  const day = Number(req.body.day);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid test email address.' });
  }
  const { getOnboardingEmailByDay, getTrialReminderEmail } = require('./lib/onboarding-emails');
  const built = Number.isFinite(day)
    ? getOnboardingEmailByDay(day, { email, name, tier, trialEndStr: 'Friday, August 21, 2026', daysLeft: 5 })
    : getTrialReminderEmail(Number(req.body.daysLeft) || 1, { email, name, tier, trialEndStr: 'Tomorrow', daysLeft: 1 });
  if (!built) {
    return res.status(400).json({ ok: false, error: 'Unknown day / daysLeft. Use day 0|1|3|7|25 or daysLeft 5|1.' });
  }
  try {
    const delivery = await deliverEmail(email, built.subject, built.html, {
      name: built.templateParams.name,
      tier,
      tierBenefits: built.templateParams.tier_benefits,
      bodyHtml: built.templateParams.body_html,
      emailSubject: built.subject,
      html: built.html,
    });
    return res.status(delivery.sent ? 200 : 502).json({
      ok: Boolean(delivery.sent),
      emailSent: Boolean(delivery.sent),
      provider: delivery.provider || null,
      subject: built.subject,
      day: built.day,
      kind: built.kind,
      error: delivery.error || null,
    });
  } catch (err) {
    return res.status(502).json({ ok: false, emailSent: false, error: err.message });
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
  const { refreshLiveDashboard } = require('./lib/live-aggregator');
  const intervalMs = Math.max(60000, parseInt(process.env.LIVE_POLL_INTERVAL_MS || '180000', 10) || 180000); // default 3 min
  const bootDelay = Math.max(8000, parseInt(process.env.LIVE_POLL_BOOT_DELAY_MS || '20000', 10) || 20000);
  const tick = () => {
    if (pipelineGuards.shouldSkipHeavyJob('live-dashboard')) return;
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('live-refresh', 'cron:live-refresh', () => refreshLiveDashboard())
      .then((result) => {
        const beatErr = result?.beat?.error;
        if (beatErr) console.warn('[live-dashboard] beat:', beatErr);
        else console.log('[live-dashboard] refreshed');
      })
      .catch((err) => console.warn('[live-dashboard]', err.message));
  };

  if (!pipelineGuards.guardScheduledJobStart('live-dashboard')) {
    // Do not one-shot refreshBeatStream when schedulers are off — X timeline pulls
    // can block the event loop past Render's 5s /health timeout.
    console.log('Live dashboard: boot beat refresh skipped (scheduled jobs off)');
    return;
  }

  if (_gvLiveSchedulerStarted) return;
  _gvLiveSchedulerStarted = true;
  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Live dashboard: polling every', Math.round(intervalMs / 1000), 's');
}

let _gvIngestSchedulerStarted = false;
function startOn3IngestScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('on3-ingest')) return;
  if (process.env.ON3_INGEST_ENABLED !== 'true') return;
  if (_gvIngestSchedulerStarted) return;
  _gvIngestSchedulerStarted = true;
  const { runOn3Ingest } = require('./lib/on3-ingest');
  const intervalMs = Math.max(60000, parseInt(process.env.ON3_INGEST_INTERVAL_MS || '120000', 10) || 120000);
  const bootDelay = Math.max(5000, parseInt(process.env.ON3_INGEST_BOOT_DELAY_MS || '15000', 10) || 15000);

  const tick = () => {
    if (pipelineGuards.shouldSkipHeavyJob('on3-ingest')) return;
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('recruiting-ingest', 'cron:recruiting-ingest', () => runOn3Ingest())
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

let _gvRivalsPmSchedulerStarted = false;
function startRivalsPmIngestScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('rivals-pm-ingest')) return;
  if (process.env.RIVALS_PM_INGEST_ENABLED !== 'true') return;
  if (_gvRivalsPmSchedulerStarted) return;
  _gvRivalsPmSchedulerStarted = true;
  const { runRivalsPredictionIngest } = require('./lib/rivals-prediction-ingest');
  const intervalMs = Math.max(120000, parseInt(process.env.RIVALS_PM_INTERVAL_MS || '300000', 10) || 300000);
  const bootDelay = Math.max(10000, parseInt(process.env.RIVALS_PM_BOOT_DELAY_MS || '45000', 10) || 45000);

  const tick = () => {
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('rivals-pm-ingest', 'cron:rivals-pm-ingest', () => runRivalsPredictionIngest())
      .then((r) => {
        if (r.processedCount) {
          console.log('[rivals-pm] processed', r.processedCount, 'new prediction(s)');
        }
      })
      .catch((err) => console.warn('[rivals-pm]', err.message));
  };

  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Rivals PM ingest: enabled (every', Math.round(intervalMs / 1000), 's)');
}


let _gvAllowlistFcBootStarted = false;
function startAllowlistFuturecastBootProvision() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) return;
  if (_gvAllowlistFcBootStarted) return;
  _gvAllowlistFcBootStarted = true;
  const bootDelay = Math.max(
    45000,
    parseInt(process.env.ALLOWLIST_FC_BOOT_DELAY_MS || '120000', 10) || 120000
  );
  setTimeout(() => {
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('allowlist-futurecast-provision', 'cron:allowlist-futurecast-provision', () => {
        const { runAllowlistFuturecastProvision } = require('./lib/allowlist-futurecast-provision');
        return runAllowlistFuturecastProvision({ classYear: 2028 });
      })
      .then((r) => {
        console.log(
          '[allowlist-fc-provision] boot run — provisioned',
          r.provisioned || 0,
          'skipped',
          r.skipped || 0,
          'failed',
          r.failed || 0,
          'of',
          r.total || 0
        );
      })
      .catch((err) => console.warn('[allowlist-fc-provision] boot run failed:', err.message));
  }, bootDelay);
  console.log('Allowlist FutureCast provision: boot run scheduled in', Math.round(bootDelay / 1000), 's');
}

let _gvBeatLateIngestStarted = false;
function startBeatLateIngestScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('beat-late-ingest')) return;
  if (_gvBeatLateIngestStarted) return;
  _gvBeatLateIngestStarted = true;
  const intervalMs = Math.max(
    60000,
    parseInt(process.env.BEAT_LATE_INGEST_INTERVAL_MS || '300000', 10) || 300000
  );
  const bootDelay = Math.max(30000, parseInt(process.env.BEAT_LATE_INGEST_BOOT_DELAY_MS || '60000', 10) || 60000);

  const tick = () => {
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('beat-late-ingest', 'cron:beat-late-ingest', () => {
        const { runBeatLateIngestSweep } = require('./lib/beat-writer-ingest');
        return runBeatLateIngestSweep();
      })
      .then((r) => {
        try {
          require('./lib/pipeline-health').recordBeatLateIngest(r);
        } catch {
          /* optional */
        }
        if (r.processedCount) {
          console.log('[beat-late-ingest] recovered', r.processedCount, 'missed post(s)');
        } else {
          console.log('[beat-late-ingest] sweep ok — processed', r.processedCount || 0, 'postsFetched', r.postsFetched || 0);
        }
      })
      .catch((err) => console.warn('[beat-late-ingest]', err.message));
  };

  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Beat late ingest sweep: every', Math.round(intervalMs / 1000), 's');
}

let _gvPipelineMonitoringStarted = false;
function startPipelineMonitoringScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('pipeline-monitoring')) return;
  if (_gvPipelineMonitoringStarted) return;
  _gvPipelineMonitoringStarted = true;
  const monitoring = require('./lib/recruiting-monitoring');
  const intervalMs = Math.max(
    300000,
    parseInt(process.env.MONITORING_HEALTH_INTERVAL_MS || String(15 * 60 * 1000), 10) || 15 * 60 * 1000
  );
  const bootDelay = Math.max(120000, parseInt(process.env.MONITORING_HEALTH_BOOT_DELAY_MS || '180000', 10) || 180000);

  const tick = () => {
    monitoring.runHealthCheck().catch((err) => console.warn('[pipeline-monitoring]', err.message));
  };

  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Pipeline monitoring: every', Math.round(intervalMs / 60000), 'min');
}

let _gvGm2AutoRepairStarted = false;
function startGm2AutoRepairScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('gm2-auto-repair')) return;
  if (process.env.GM2_AUTO_REPAIR_ENABLED === 'false') return;
  if (_gvGm2AutoRepairStarted) return;
  _gvGm2AutoRepairStarted = true;
  const gm2 = require('./lib/gm2');
  const intervalMs = Math.max(
    3600000,
    parseInt(process.env.GM2_AUTO_REPAIR_INTERVAL_MS || String(24 * 3600000), 10) || 24 * 3600000
  );
  const bootDelay = Math.max(60000, parseInt(process.env.GM2_AUTO_REPAIR_BOOT_DELAY_MS || '120000', 10) || 120000);

  const tick = (source) => {
    const opsMonitor = require('./lib/ops-monitor');
    return opsMonitor
      .wrapJob('gm2-auto-repair', 'cron:gm2-auto-repair', () => gm2.runAutoRepair({ source }))
      .catch((err) => console.warn('[gm2:auto-repair]', err.message));
  };

  setTimeout(() => tick('boot'), bootDelay);
  setInterval(() => tick('nightly'), intervalMs);
  console.log('[gm2:auto-repair] enabled (every', Math.round(intervalMs / 3600000), 'h, boot delay', Math.round(bootDelay / 1000), 's)');
}

function startMediaIngestScheduler() {
  if (!pipelineGuards.guardScheduledJobStart('media-ingest')) return;
  if (process.env.MEDIA_INGEST_ENABLED !== 'true') return;
  if (_gvMediaIngestStarted) return;
  _gvMediaIngestStarted = true;
  const { runMediaIngest } = require('./lib/media-ingest');
  const brand = require('./lib/media-brand');
  const intervalMs = Math.max(300000, parseInt(process.env.MEDIA_INGEST_INTERVAL_MS || '900000', 10) || 900000);
  const bootDelay = Math.max(10000, parseInt(process.env.MEDIA_INGEST_BOOT_DELAY_MS || '45000', 10) || 45000);

  const tick = () => {
    const opsMonitor = require('./lib/ops-monitor');
    opsMonitor
      .wrapJob('media-ingest', 'cron:media-ingest', () => runMediaIngest())
      .then((r) => {
        const n = r.process?.processed?.length || 0;
        const d = r.discover?.discovered?.length || 0;
        if (n || d) console.log('[media-ingest] discovered', d, 'processed', n);
        if (!r.ffmpeg) console.warn('[media-ingest] ffmpeg missing — clips queued but not processed');
      })
      .catch((err) => console.warn('[media-ingest]', err.message));
  };

  if (!brand.hasFfmpeg()) {
    console.warn('Media ingest: enabled but ffmpeg not found — install ffmpeg for processing');
  }
  setTimeout(tick, bootDelay);
  setInterval(tick, intervalMs);
  console.log('Media ingest: enabled (every', Math.round(intervalMs / 1000), 's)');
}

app.use(express.static(__dirname));

app.use('/api', (req, res) => {
  res.status(404).type('json').json({ ok: false, error: 'Not found', method: req.method, path: req.originalUrl });
});

app.use((err, req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(err.status || 500).type('json').json({ ok: false, error: err.message || 'Internal server error' });
  }
  next(err);
});

apiRoutesReady = true;
global.__GV_API_ROUTES_READY__ = true;
console.log('[boot] API routes ready');
const providers = getEmailProviders();
console.log('🚀 API server started with commit:', process.env.RENDER_GIT_COMMIT || process.env.GV_BUILD || 'dev');
console.log('GatorVault server running on port', PORT);

// CRITICAL: verifyBoot can block the event loop past Render's ~5s /health timeout.
// Mark routes ready first, keep /health answering, then verify in the background.
if (process.env.GUARDIAN_BOOT_SKIP === 'true') {
  console.warn('[guardian] GUARDIAN_BOOT_SKIP=true — boot verification disabled');
} else {
  const parsedGuardianDelay = parseInt(process.env.GUARDIAN_BOOT_DELAY_MS || '20000', 10);
  const guardianBootDelay = Number.isFinite(parsedGuardianDelay)
    ? Math.max(5000, parsedGuardianDelay)
    : 20000;
  setTimeout(() => {
    const guardian = require('./lib/guardian/boot-guardian');
    const run = typeof guardian.verifyBootAsync === 'function'
      ? guardian.verifyBootAsync({ alert: process.env.NODE_ENV === 'production' })
      : Promise.resolve().then(() => guardian.verifyBoot({ alert: process.env.NODE_ENV === 'production' }));
    run
      .then(() => {
        console.log('[guardian] boot verified (deferred', guardianBootDelay, 'ms)');
      })
      .catch((err) => {
        console.error(err.message || err);
        if (process.env.GUARDIAN_BOOT_LENIENT === 'true') {
          console.warn('[guardian] GUARDIAN_BOOT_LENIENT=true — continuing despite boot verification failure');
          return;
        }
        console.error('[guardian] boot verification failed after early listen — continuing in degraded mode');
        require('./lib/guardian/guardian-alerts')
          .alertGuardian({
            type: 'boot_failed',
            severity: 'critical',
            title: 'API boot degraded',
            message: String(err.message || err).slice(0, 500),
            notifySms: true
          })
          .catch(() => {});
      });
  }, guardianBootDelay);
  console.log('[guardian] boot verify deferred', guardianBootDelay, 'ms');
}

// Yield so Render /ready can answer before post-boot schedulers/store init.
// Light path first (App Review account); heavy sync work is deferred so /health
// stays under Render's ~5s probe during the first minutes after deploy.
setImmediate(startPostBootServices);

function startPostBootServices() {
  try {
    const { getUsersStoreInfo } = require('./lib/user-store');
    const store = getUsersStoreInfo();
    console.log(
      '[user-store] path=',
      store.path,
      'accounts=',
      store.count,
      'durableEnv=',
      store.durableEnv
    );
    if (!store.durableEnv) {
      console.warn(
        '[user-store] GV_USERS_PATH unset — accounts live on ephemeral disk and will be wiped on redeploy'
      );
    }
  } catch (storeErr) {
    console.warn('[user-store] boot info failed:', storeErr.message || storeErr);
  }
  // Defer scrypt user-store work so first /health probes stay instant after wiring.
  setTimeout(() => {
    try {
      const { ensureAppReviewAccountOnBoot } = require('./lib/app-review-provision');
      const reviewBoot = ensureAppReviewAccountOnBoot();
      if (reviewBoot.skipped) {
        console.log('[app-review] boot provision skipped:', reviewBoot.reason);
      } else if (reviewBoot.ok) {
        console.log(
          '[app-review] boot provision ok —',
          reviewBoot.created ? 'created' : reviewBoot.passwordReset ? 'password-reset' : 'ready',
          reviewBoot.email
        );
      } else {
        console.warn('[app-review] boot provision failed:', reviewBoot.error || 'unknown');
      }
    } catch (e) {
      console.warn('[app-review] boot provision skipped:', e.message);
    }
  }, Math.max(2000, parseInt(process.env.APP_REVIEW_BOOT_DELAY_MS || '5000', 10) || 5000));

  const deferHeavyMs = Math.max(
    60000,
    parseInt(process.env.API_BOOT_DEFER_HEAVY_MS || '180000', 10) || 180000
  );
  const deferLightMs = Math.max(
    15000,
    parseInt(process.env.API_BOOT_DEFER_LIGHT_MS || '30000', 10) || 30000
  );
  const deferSchedMs = Math.max(
    deferLightMs + 30000,
    parseInt(process.env.API_BOOT_DEFER_SCHED_MS || '120000', 10) || 120000
  );
  console.log(
    '[boot] deferring light',
    deferLightMs,
    'ms; schedulers',
    deferSchedMs,
    'ms; heavy warm',
    deferHeavyMs,
    'ms'
  );
  setTimeout(startPostBootLightServices, deferLightMs);
  setTimeout(startPostBootRecruitingAndSchedulers, deferSchedMs);
  setTimeout(startPostBootHeavyServices, deferHeavyMs);
}

/** Tiny store seeds only — keep this cheap so /health stays green. */
function startPostBootLightServices() {
  try {
    const { rememberTrial } = require('./lib/trial-ledger');
    const existingUsers = loadUsers();
    let seeded = 0;
    for (const u of existingUsers) {
      if (!u?.email || !u?.trialEnd) continue;
      rememberTrial(u.email, {
        trialEnd: u.trialEnd,
        trialStart: u.createdAt,
        createdAt: u.createdAt,
      });
      seeded += 1;
    }
    console.log('[trial-ledger] seeded', seeded, 'active accounts');
  } catch (e) {
    console.warn('[trial-ledger] seed skipped:', e.message);
  }
  try {
    const deployCache = require('./lib/deploy-cache');
    const inv = deployCache.invalidateAllOnDeploy();
    console.log('[deploy-cache] boot invalidation at', inv.at);
  } catch (e) {
    console.warn('[deploy-cache] invalidate skipped:', e.message);
  }
}

/**
 * Dashboard warm — opt-in only.
 * Sync warmDashboardCache + 45s background refresh was still stalling Render
 * /health (~5s) ~20 minutes after deploy (API_BOOT_DEFER_HEAVY_MS) → crash loop.
 * Set API_BOOT_HEAVY_WARM=true only when the API is proven stable.
 */
function startPostBootHeavyServices() {
  if (process.env.API_BOOT_HEAVY_WARM !== 'true') {
    console.log('[live-dashboard] heavy cache warm skipped (set API_BOOT_HEAVY_WARM=true to enable)');
    return;
  }
  try {
    const dashCache = require('./lib/live-dashboard-cache');
    setImmediate(() => {
      try {
        dashCache.warmDashboardCache();
        dashCache.scheduleBackgroundRefresh();
        console.log(
          '[live-dashboard] cache warmed (' + (dashCache.getCacheMeta().feedCount || 0) + ' feed items)'
        );
      } catch (warmErr) {
        console.warn('[live-dashboard] cache warm failed:', warmErr.message || warmErr);
      }
    });
    console.log('[live-dashboard] heavy cache warm starting (deferred boot phase)');
  } catch (e) {
    console.warn('[live-dashboard] cache warm skipped:', e.message);
  }
}

function startPostBootRecruitingAndSchedulers() {
  try {
    const store = require('./lib/recruiting-store');
    console.log('Recruiting API: ready (storage:', store.storageMode() + ')');
    const patternStore = require('./lib/identity-patterns-store');
    patternStore
      .listAllPatterns()
      .then((items) => {
        if (items.length) {
          console.log('[identity-patterns] ready (' + items.length + ' players, ' + patternStore.storageMode() + ')');
          return null;
        }
        const rebuildDelay = Math.max(
          120000,
          parseInt(process.env.IDENTITY_PATTERNS_BOOT_REBUILD_DELAY_MS || '600000', 10) || 600000
        );
        console.log('[identity-patterns] empty — deferring boot rebuild', rebuildDelay, 'ms');
        setTimeout(() => {
          if (pipelineGuards.shouldSkipHeavyJob('identity-patterns-boot-rebuild')) return;
          patternStore
            .rebuildAllPatterns()
            .then((r) => {
              console.log('[identity-patterns] boot rebuild:', r.count, 'players in', r.durationMs, 'ms');
              try {
                const opsMonitor = require('./lib/ops-monitor');
                opsMonitor.logEvent({
                  subsystem: 'cron:identity-patterns',
                  status: 'success',
                  message: 'Identity patterns boot rebuild',
                  details: { count: r.count, durationMs: r.durationMs, boot: true }
                });
              } catch {
                /* optional */
              }
            })
            .catch((err) => console.warn('[identity-patterns] boot rebuild failed:', err.message));
        }, rebuildDelay);
        return null;
      })
      .catch((err) => console.warn('[identity-patterns] boot sync skipped:', err.message));
    if (!pipelineGuards.scheduledJobsEnabled()) {
      console.log('[recruiting-alerts] boot purge skipped — X_SCHEDULED_JOBS_ENABLED is not true');
    } else {
      const { runPurgeFalseBrewsterIntel } = require('./lib/recruiting-public-alerts');
      const purgeDelay = Math.max(
        60000,
        parseInt(process.env.ALERT_PURGE_BOOT_DELAY_MS || '300000', 10) || 300000
      );
      setTimeout(() => {
        if (pipelineGuards.shouldSkipHeavyJob('alert-purge-boot')) return;
        runPurgeFalseBrewsterIntel({ refresh: true })
          .then((r) => {
            if (r.before.falseCommitEvents || r.before.falseCommitIntel || r.before.falseCommitFeed) {
              console.log('[recruiting-alerts] purged false Brewster intel:', r.before, '→', r.after);
            }
          })
          .catch((err) => console.warn('[recruiting-alerts] Brewster purge skipped:', err.message));
        const { runPurgeInvalidHeadlines } = require('./lib/recruiting-public-alerts');
        runPurgeInvalidHeadlines({ refresh: true })
          .then((r) => {
            if (r.before?.invalidHeadlines || r.feedResult?.removed) {
              console.log('[headlines] purged invalid/stale headlines:', r.before, '→', r.after, 'removed', r.feedResult?.removed);
            }
          })
          .catch((err) => console.warn('[headlines] purge skipped:', err.message));
      }, purgeDelay);
    }
    if (!pipelineGuards.scheduledJobsEnabled()) {
      console.log('[recruiting-hub] in-process refresh skipped — X_SCHEDULED_JOBS_ENABLED is not true');
      console.log('[player-intelligence] in-process refresh skipped — X_SCHEDULED_JOBS_ENABLED is not true');
    } else {
      try {
        const { scheduleRecruitingHubRefresh } = require('./lib/recruiting-hub-refresh');
        scheduleRecruitingHubRefresh();
      } catch (e) {
        console.warn('[recruiting-hub] refresh scheduler skipped:', e.message);
      }
      try {
        const {
          schedulePlayerIntelligenceRefresh,
          refreshTierAIntelligence
        } = require('./lib/player-intelligence-refresh');
        schedulePlayerIntelligenceRefresh();
        // Opt-in only — boot Tier-A refresh was blocking /health on Starter.
        if (process.env.PLAYER_INTEL_REFRESH_ON_BOOT === 'true') {
          const intelDelay = Math.max(
            60000,
            parseInt(process.env.PLAYER_INTEL_BOOT_DELAY_MS || '180000', 10) || 180000
          );
          setTimeout(() => {
            if (pipelineGuards.shouldSkipHeavyJob('player-intel-boot')) return;
            refreshTierAIntelligence({ verbose: false })
              .then((result) => {
                console.log(
                  '[player-intelligence] boot refresh:',
                  result.processed,
                  'players, goldenFour complete:',
                  result.goldenFour?.complete === true
                );
              })
              .catch((err) => console.warn('[player-intelligence] boot refresh failed:', err.message));
          }, intelDelay);
        }
      } catch (e) {
        console.warn('[player-intelligence] refresh scheduler skipped:', e.message);
      }
    }
    try {
      const { scheduleHubBootPipeline } = require('./lib/recruiting-hub-cache');
      scheduleHubBootPipeline();
    } catch (e) {
      console.warn('[recruiting-hub] boot warm skipped:', e.message);
    }
  } catch (e) {
    console.warn('Recruiting API: failed to init', e.message);
  }
  try {
    ensurePublishedSeed();
    const contentAudit = auditPublishedArticles();
    console.log('Content API: ready (accuracy validation + review queue)', contentAudit);
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
    const rosterStore = require('./lib/roster-store');
    const rosterCount = rosterStore.getAllRosterPlayers().length;
    console.log('Roster API: ready (' + rosterCount + ' players)');
    if (!rosterCount) console.warn('[roster] players.json empty or unreadable — check data/roster/players.json');
  } catch (e) {
    console.warn('Roster API: failed to init', e.message);
  }
  try {
    const intelStore = require('./lib/recruiting-intel-store');
    intelStore
      .initIntelStore()
      .then((info) => console.log('[intel-store] ready', info))
      .catch((err) => console.warn('[intel-store] init failed:', err.message))
      .finally(() => {
        try {
          const ghost = intelStore.reconcileGhostQueuedIntel();
          if (ghost.cleared) {
            console.warn('[startup] cleared', ghost.cleared, 'ghost xPostQueued intel flag(s)');
          }
        } catch (e) {
          console.warn('[startup] intel reconcile skipped:', e.message);
        }
        {
          let stayGreenBoot = false;
          try {
            stayGreenBoot = require('./lib/api-stay-green').isStayGreen();
          } catch {
            stayGreenBoot = process.env.NODE_ENV === 'production';
          }
          // Stay-green / App Review: skip boot commitment reconcile (heavy store walk).
          if (process.env.COMMIT_TARGET_RECONCILE_BOOT !== 'false' && !stayGreenBoot) {
            const bootDelay = parseInt(process.env.COMMIT_TARGET_RECONCILE_BOOT_DELAY_MS || '180000', 10);
            setTimeout(async () => {
              try {
                const store = require('./lib/recruiting-store');
                const { reconcileCommittedTargetsFromStore } = require('./lib/commit-target-cleanup');
                const out = await reconcileCommittedTargetsFromStore(store, {
                  source: 'boot_reconcile',
                  quiet: true,
                });
                if (out.removedBoardEntries > 0) {
                  console.log(
                    '[commit-target-cleanup] boot reconcile removed',
                    out.removedBoardEntries,
                    'stale board row(s)'
                  );
                }
              } catch (e) {
                console.warn('[commit-target-cleanup] boot reconcile skipped:', e.message);
              }
            }, bootDelay);
          } else if (stayGreenBoot) {
            console.log('[commit-target-cleanup] boot reconcile skipped (api stay-green)');
          }
        }
      });
  } catch (e) {
    console.warn('[startup] intel init skipped:', e.message);
  }
  try {
    require('./lib/push-alert-service')
      .initPushAlertStore()
      .then((info) => console.log('[push-store] ready', info))
      .catch((err) => console.warn('[push-store] init failed:', err.message));
  } catch (e) {
    console.warn('[startup] push store init skipped:', e.message);
  }
  try {
    require('./lib/alert-email-prefs-service')
      .initAlertEmailPrefsStore()
      .then((info) => console.log('[alert-email] ready', info))
      .catch((err) => console.warn('[alert-email] init failed:', err.message));
  } catch (e) {
    console.warn('[startup] alert email init skipped:', e.message);
  }
  try {
    startOn3IngestScheduler();
  } catch (e) {
    console.warn('On3 ingest scheduler failed to start', e.message);
  }
  try {
    startRivalsPmIngestScheduler();
  } catch (e) {
    console.warn('Rivals PM ingest scheduler failed to start', e.message);
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
    startBeatLateIngestScheduler();
    startPipelineMonitoringScheduler();
  } catch (e) {
    console.warn('Live dashboard scheduler failed to start', e.message);
  }
  try {
    if (!pipelineGuards.scheduledJobsEnabled()) {
      console.log('[onboarding] scheduler skipped — X_SCHEDULED_JOBS_ENABLED is not true');
    } else {
      startOnboardingScheduler({ loadUsers, saveUsers, deliverEmail, pushEmailLog });
    }
  } catch (e) {
    console.warn('Onboarding scheduler init skipped', e.message);
  }
  try {
    if (!pipelineGuards.scheduledJobsEnabled()) {
      console.log('[autoposter] schedulers skipped — X_SCHEDULED_JOBS_ENABLED is not true');
    } else {
      const { startXAutoposterScheduler } = require('./lib/x-autoposter');
      const { verifyOAuth1Credentials } = require('./lib/x-oauth1');
      verifyOAuth1Credentials()
        .then((s) => {
          if (s.ok) console.log('[autoposter] OAuth1 startup verify PASS — @' + s.screenName);
          else console.warn('[autoposter] OAuth1 startup verify FAIL —', s.error);
        })
        .catch((err) => console.warn('[autoposter] OAuth1 startup verify error', err.message));
      startXAutoposterScheduler();
      try {
        const { startDetectivesScheduler } = require('./lib/autoposter/detectives-scheduler');
        startDetectivesScheduler();
        console.log('[detectives] background scheduler started');
      } catch (detectivesErr) {
        console.warn('[detectives] scheduler init skipped', detectivesErr.message);
      }
      try {
        const freshness = require('./lib/autoposter-freshness');
        const scheduler = require('./lib/x-autoposter').getSchedulerStatus();
        const synced = freshness.syncLastPostFromScheduler(scheduler);
        if (synced.lastPostAt) {
          console.log('[autoposter] last-post.json synced:', synced.lastPostAt);
        }
      } catch (syncErr) {
        console.warn('[autoposter] last-post sync skipped:', syncErr.message);
      }
    }
  } catch (e) {
    console.warn('X AutoPoster scheduler failed to start', e.message);
  }
  try {
    if (!pipelineGuards.scheduledJobsEnabled()) {
      console.log('[portal] On3 transfer sync skipped — X_SCHEDULED_JOBS_ENABLED is not true');
    } else {
    const { syncPortalFromOn3 } = require('./lib/on3-ingest');
    const bootDelay = Math.max(5000, parseInt(process.env.ON3_PORTAL_SYNC_BOOT_DELAY_MS || '12000', 10) || 12000);
    setTimeout(() => {
      if (pipelineGuards.shouldSkipHeavyJob('portal-ingest')) return;
      const opsMonitor = require('./lib/ops-monitor');
      opsMonitor
        .wrapJob('portal-ingest', 'cron:portal-ingest', () => syncPortalFromOn3())
        .then((r) => console.log('[portal] On3 transfer sync:', r.count, 'players from', r.url))
        .catch((err) => console.warn('[portal] On3 transfer sync failed:', err.message));
    }, bootDelay);
    }
  } catch (e) {
    console.warn('Portal sync on boot failed to schedule', e.message);
  }
  try {
    startMediaIngestScheduler();
  } catch (e) {
    console.warn('Media ingest scheduler failed to start', e.message);
  }
  if (pipelineGuards.scheduledJobsEnabled() && process.env.FILM_ROOM_SYNC_ENABLED === 'true') {
    try {
      const { rebuildFilmRoomCatalog } = require('./lib/film-room-feed');
      const filmInterval = parseInt(process.env.FILM_ROOM_SYNC_INTERVAL_MS || '21600000', 10);
      const runFilmSync = () => {
        if (pipelineGuards.shouldSkipHeavyJob('film-room-sync')) return;
        const opsMonitor = require('./lib/ops-monitor');
        opsMonitor
          .wrapJob('film-room-weekly', 'cron:film-room-weekly', () => {
            const c = rebuildFilmRoomCatalog();
            return { ok: true, counts: c?.counts, processedCount: c?.counts?.total || null };
          })
          .then((c) => console.log('[film-room] knowledge engine refreshed:', c?.counts || c))
          .catch((err) => console.warn('[film-room] knowledge refresh failed:', err.message));
      };
      const filmBootDelay = Math.max(
        60000,
        parseInt(process.env.FILM_ROOM_SYNC_BOOT_DELAY_MS || '600000', 10) || 600000
      );
      setTimeout(runFilmSync, filmBootDelay);
      setInterval(runFilmSync, filmInterval);
    } catch (e) {
      console.warn('Film Room knowledge refresh scheduler failed to start', e.message);
    }
  }
  if (pipelineGuards.scheduledJobsEnabled() && process.env.SCOUTING_UPDATE_ENABLED === 'true') {
    try {
      const scoutingInterval = parseInt(process.env.SCOUTING_UPDATE_INTERVAL_MS || '21600000', 10);
      const runScoutingUpdate = () => {
        const opsMonitor = require('./lib/ops-monitor');
        const { runContinuousScoutingUpdate, isCycleRunning } = require('./lib/scouting-update-engine');
        if (isCycleRunning()) {
          console.log('[scouting-update] skip — cycle already running');
          return Promise.resolve({ ok: true, skipped: true });
        }
        return opsMonitor.wrapJob('scouting-update', 'cron:scouting-update', () =>
          runContinuousScoutingUpdate({ reason: 'scheduled_cron' })
        );
      };
      const scoutingBootDelay = Math.max(
        180000,
        parseInt(process.env.SCOUTING_UPDATE_BOOT_DELAY_MS || '300000', 10) || 300000
      );
      setTimeout(() => {
        runScoutingUpdate()
          .then((r) => console.log('[scouting-update] initial run:', r?.updated ?? 0, 'updated of', r?.total ?? 0))
          .catch((err) => console.warn('[scouting-update] initial run failed:', err.message));
      }, scoutingBootDelay);
      setInterval(() => {
        runScoutingUpdate()
          .then((r) => {
            if (!r?.skipped) {
              console.log('[scouting-update] scheduled run:', r?.updated ?? 0, 'updated of', r?.total ?? 0);
            }
          })
          .catch((err) => console.warn('[scouting-update] scheduled run failed:', err.message));
      }, scoutingInterval);
      console.log('[scouting-update] continuous engine enabled (every', Math.round(scoutingInterval / 3600000), 'h)');
    } catch (e) {
      console.warn('Scouting update scheduler failed to start', e.message);
    }
  }
  if (pipelineGuards.scheduledJobsEnabled() && process.env.ARTICLE_ENGINE_ENABLED !== 'false') {
    try {
      const articleInterval = parseInt(process.env.ARTICLE_ENGINE_INTERVAL_MS || '604800000', 10);
      const runArticleEngine = () => {
        const opsMonitor = require('./lib/ops-monitor');
        const { generateWeeklyDrafts } = require('./lib/insider-articles-engine');
        opsMonitor
          .wrapJob('article-engine-weekly-draft', 'cron:article-engine', () => generateWeeklyDrafts())
          .then((r) => console.log('[insider-articles] weekly draft run:', r?.selected ?? r?.reason ?? r))
          .catch((err) => console.warn('[insider-articles] weekly draft failed:', err.message));
      };
      setTimeout(runArticleEngine, Math.max(180000, parseInt(process.env.ARTICLE_ENGINE_BOOT_DELAY_MS || '300000', 10) || 300000));
      setInterval(runArticleEngine, articleInterval);
      console.log('[insider-articles] weekly scheduler enabled (every', Math.round(articleInterval / 3600000), 'h)');
      try {
        const { runGameWeekAutoPublish } = require('./lib/insider-articles-auto-publish');
        const articleStore = require('./lib/insider-articles-store');
        const { generateDraftForType } = require('./lib/insider-articles-engine');
        setInterval(() => runGameWeekAutoPublish({
          listDrafts: () => articleStore.listDrafts({ status: null }),
          generateDraftForType,
          approveDraft: (id) => articleStore.approveDraft(id),
          publishToContentFeed: (d) => articleStore.publishToContentFeed(d),
        }).then((r) => { if (r?.published) console.log('[game-week-auto] published:', r.id); }).catch((e) => console.warn('[game-week-auto]', e.message)), 3600000);
        console.log('[game-week-auto] Monday 8 AM ET scheduler enabled');
      } catch (e) { console.warn('[game-week-auto] failed', e.message); }
    } catch (e) {
      console.warn('Insider Articles scheduler failed to start', e.message);
    }
  }
  try {
    startGm2AutoRepairScheduler();
  } catch (e) {
    console.warn('GM2 auto-repair scheduler failed to start', e.message);
  }
  if (providers.length) {
    console.log('Email delivery: configured (' + providers.join(', ') + ')');
  } else {
    console.warn('Email delivery: NOT configured — welcome emails will not send from server.');
    console.warn('  Fix: copy server/.env.example to server/.env and set EmailJS or SMTP (see README).');
  }
  try {
    const deployMonitor = require('./lib/deploy-monitor');
    deployMonitor.recordApiBoot();
    deployMonitor.recordFrontendDeploy();
    console.log('[gv-om] Operations Manager initialized');
  } catch (e) {
    console.warn('[gv-om] init skipped', e.message);
  }
  if (!pipelineGuards.scheduledJobsEnabled()) {
    console.log('[platform] maintenance/QA/product-intel/watchdog skipped — X_SCHEDULED_JOBS_ENABLED is not true');
  } else {
    try {
      const { startPlatformMaintenanceSchedulers } = require('./lib/platform-maintenance-scheduler');
      startPlatformMaintenanceSchedulers();
    } catch (e) {
      console.warn('[platform] maintenance schedulers failed to start', e.message);
    }
    try {
      const { startPlatformHealthSweepScheduler } = require('./lib/platform-health-sweep');
      startPlatformHealthSweepScheduler();
    } catch (e) {
      console.warn('[platform] health sweep scheduler failed to start', e.message);
    }
    try {
      const { startQaScheduler } = require('./lib/qa/qa-runner');
      startQaScheduler();
    } catch (e) {
      console.warn('[qa] scheduler failed to start', e.message);
    }
    try {
      const { startProductIntelScheduler } = require('./lib/product-intel/product-intel-scheduler');
      startProductIntelScheduler();
    } catch (e) {
      console.warn('[product-intel] scheduler failed to start', e.message);
    }
    try {
      require('./lib/guardian/runtime-watchdog').startRuntimeWatchdog();
    } catch (e) {
      console.warn('[guardian] runtime watchdog failed to start', e.message);
    }
  }
} // startPostBootRecruitingAndSchedulers

} // wireApplicationRest
