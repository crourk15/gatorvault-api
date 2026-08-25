/**
 * Forgot / reset password — signed tokens (HMAC) via deliverEmail (Resend-first).
 *
 * Tokens are stateless so a Render bounce or a second "forgot password" click
 * cannot invalidate the email the member already has. Changing the password
 * rotates the version stamp and kills unused links.
 */
const crypto = require('crypto');
const { hashPassword } = require('./password-auth');
const { findUserByEmail, updateUser } = require('./user-store');
const {
  emailShell,
  ctaButton,
  displayNameFrom,
  SITE_URL,
  SUPPORT_EMAIL,
} = require('./onboarding-emails');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — setup emails were dying at 1 hour
const RESET_PATH = '/reset/';

function resetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.SESSION_SECRET ||
    'change-me-in-production'
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function versionStamp(user) {
  const raw = String(user?.passwordHash || user?.passwordResetCompletedAt || user?.createdAt || '0');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function signResetToken(email, user, ttlMs = TOKEN_TTL_MS) {
  const payload = {
    e: String(email || '')
      .trim()
      .toLowerCase(),
    v: versionStamp(user),
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', resetSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function readSignedResetToken(token) {
  const raw = String(token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!body || !sig) return null;
  const check = crypto.createHmac('sha256', resetSecret()).update(body).digest('base64url');
  if (!timingSafeEqualStr(sig, check)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const email = String(payload?.e || '')
      .trim()
      .toLowerCase();
    const exp = Number(payload?.exp);
    if (!email || !Number.isFinite(exp) || exp < Date.now()) return null;
    return { email, v: String(payload.v || ''), exp };
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildResetUrl({ email, token } = {}) {
  const base = `${SITE_URL}${RESET_PATH}`;
  const params = new URLSearchParams({
    email: String(email || '').trim().toLowerCase(),
    token: String(token || ''),
  });
  return `${base}?${params.toString()}`;
}

function getPasswordResetEmail({ name, email, resetUrl, setup = false } = {}) {
  const displayName = displayNameFrom({ name, email });
  const subject = setup ? 'Create your GatorVault password' : 'Reset your GatorVault password';
  const lead = setup
    ? `Your GatorVault access is ready for <strong>${escapeHtml(email)}</strong>. Create a password with the button below.`
    : `We received a request to reset the password for <strong>${escapeHtml(email)}</strong>.`;
  const ctaLabel = setup ? 'Create password' : 'Reset password';
  const bodyInner = `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${escapeHtml(displayName)},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${lead}</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">This link works for 24 hours. Open it in <strong>Safari or Chrome</strong> — not the GatorVault app.</p>
  ${ctaButton(resetUrl, ctaLabel)}
  <p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.55;">Or paste this URL into your browser:<br/>${escapeHtml(resetUrl)}</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">If you did not request this, you can ignore this email.</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
  const html = emailShell(bodyInner);
  return {
    kind: setup ? 'password_setup' : 'password_reset',
    subject,
    html,
    templateParams: {
      name: displayName,
      email: email || '',
      body_html: bodyInner,
      vault_url: resetUrl,
      vault_link_label: ctaLabel,
      support_email: SUPPORT_EMAIL,
      email_subject: subject,
    },
  };
}

/**
 * Always returns a generic success shape (no email enumeration).
 */
async function requestPasswordReset(emailRaw, { deliverEmail, setup = false } = {}) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: true, accepted: true };
  }
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: true, accepted: true, found: false };
  }
  if (typeof deliverEmail !== 'function') {
    return { ok: false, error: 'Email deliverer not configured.' };
  }

  const token = signResetToken(email, user);
  updateUser(email, {
    passwordResetRequestedAt: new Date().toISOString(),
    passwordResetSetup: setup === true,
  });

  const resetUrl = buildResetUrl({ email, token });
  const built = getPasswordResetEmail({
    name: user.name,
    email,
    resetUrl,
    setup: setup === true,
  });

  try {
    const delivery = await deliverEmail(email, built.subject, built.html, {
      name: built.templateParams.name,
      bodyHtml: built.templateParams.body_html,
      emailSubject: built.subject,
      html: built.html,
      vault_url: built.templateParams.vault_url,
      vault_link_label: built.templateParams.vault_link_label,
    });
    return {
      ok: true,
      accepted: true,
      found: true,
      emailSent: Boolean(delivery?.sent),
      provider: delivery?.provider || null,
      setup: setup === true,
    };
  } catch (err) {
    return {
      ok: true,
      accepted: true,
      found: true,
      emailSent: false,
      error: err?.message || 'send_failed',
    };
  }
}

function resetPasswordWithToken({ email: emailRaw, token, password } = {}) {
  const email = String(emailRaw || '').trim().toLowerCase();
  const rawToken = String(token || '').trim();
  const nextPassword = String(password || '');
  if (!email || !rawToken) {
    return { ok: false, error: 'Reset link is invalid or expired.' };
  }
  if (nextPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'Reset link is invalid or expired.' };
  }

  const signed = readSignedResetToken(rawToken);
  let accepted = false;
  if (signed) {
    if (signed.email !== email) {
      return { ok: false, error: 'Reset link is invalid or expired.' };
    }
    if (signed.v !== versionStamp(user)) {
      return { ok: false, error: 'Reset link is invalid or expired.' };
    }
    accepted = true;
  } else if (user.passwordResetTokenHash && user.passwordResetExpiresAt) {
    // Legacy in-flight emails (1-hour stored hash) still work until they expire.
    const expires = new Date(user.passwordResetExpiresAt).getTime();
    if (Number.isFinite(expires) && expires >= Date.now() && hashToken(rawToken) === user.passwordResetTokenHash) {
      accepted = true;
    }
  }

  if (!accepted) {
    return { ok: false, error: 'Reset link is invalid or expired.' };
  }

  updateUser(email, {
    passwordHash: hashPassword(nextPassword),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    passwordResetCompletedAt: new Date().toISOString(),
  });
  return { ok: true, email };
}

module.exports = {
  TOKEN_TTL_MS,
  RESET_PATH,
  hashToken,
  createResetToken,
  versionStamp,
  signResetToken,
  readSignedResetToken,
  buildResetUrl,
  getPasswordResetEmail,
  requestPasswordReset,
  resetPasswordWithToken,
};
