/**
 * Forgot / reset password — tokenized email via deliverEmail (Resend-first).
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

/** 48h — media comps + delayed inbox opens were dying on the old 1h window. */
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_PATH = '/join/?mode=reset';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildResetUrl({ email, token } = {}) {
  const base = `${SITE_URL}${RESET_PATH}`;
  const params = new URLSearchParams({
    email: String(email || '').trim().toLowerCase(),
    token: String(token || ''),
  });
  return `${base}&${params.toString()}`;
}

function getPasswordResetEmail({ name, email, resetUrl } = {}) {
  const displayName = displayNameFrom({ name, email });
  const subject = 'Reset your GatorVault password';
  const bodyInner = `
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hey ${displayName},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">We received a request to reset the password for <strong>${email}</strong>.</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">This link expires in 48 hours. If you did not request a reset, you can ignore this email.</p>
  ${ctaButton(resetUrl, 'Reset password')}
  <p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.55;">Or paste this URL into your browser:<br/>${resetUrl}</p>
  <p style="margin:16px 0 0;font-size:14px;color:#94a3b8;line-height:1.6;">— GatorVault Media, LLC</p>`;
  const html = emailShell(bodyInner);
  return {
    kind: 'password_reset',
    subject,
    html,
    templateParams: {
      name: displayName,
      email: email || '',
      body_html: bodyInner,
      vault_url: resetUrl,
      vault_link_label: 'Reset password',
      support_email: SUPPORT_EMAIL,
      email_subject: subject,
    },
  };
}

/**
 * Always returns a generic success shape (no email enumeration).
 */
async function requestPasswordReset(emailRaw, { deliverEmail } = {}) {
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

  const token = createResetToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  updateUser(email, {
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: expiresAt,
    passwordResetRequestedAt: new Date().toISOString(),
  });

  const resetUrl = buildResetUrl({ email, token });
  const built = getPasswordResetEmail({
    name: user.name,
    email,
    resetUrl,
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
  if (!user?.passwordResetTokenHash || !user?.passwordResetExpiresAt) {
    return { ok: false, error: 'Reset link is invalid or expired.' };
  }
  const expires = new Date(user.passwordResetExpiresAt).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) {
    updateUser(email, {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
    return { ok: false, error: 'Reset link is invalid or expired.' };
  }
  if (hashToken(rawToken) !== user.passwordResetTokenHash) {
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

/**
 * Admin/ops: mint a fresh reset token and return the URL (for DM paste when email lags).
 * Does not send email unless deliverEmail is provided.
 */
async function issuePasswordResetLink(emailRaw, { deliverEmail } = {}) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email is required' };
  }
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'account_not_found' };
  }

  const token = createResetToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  updateUser(email, {
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: expiresAt,
    passwordResetRequestedAt: new Date().toISOString(),
  });

  const resetUrl = buildResetUrl({ email, token });
  let emailSent = false;
  let provider = null;
  if (typeof deliverEmail === 'function') {
    const built = getPasswordResetEmail({
      name: user.name,
      email,
      resetUrl,
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
      emailSent = Boolean(delivery?.sent);
      provider = delivery?.provider || null;
    } catch {
      emailSent = false;
    }
  }

  return {
    ok: true,
    email,
    resetUrl,
    expiresAt,
    emailSent,
    provider,
  };
}

/**
 * Admin/ops: set a known password (media comps unlock when reset email fails).
 */
function setPasswordForEmail(emailRaw, passwordRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  const nextPassword = String(passwordRaw || '');
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'email is required' };
  }
  if (nextPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'account_not_found' };
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
  hashToken,
  createResetToken,
  buildResetUrl,
  getPasswordResetEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  issuePasswordResetLink,
  setPasswordForEmail,
};
