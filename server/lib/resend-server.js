/**
 * Raw HTML transactional email via Resend — no EmailJS template editor required.
 * https://resend.com/docs/api-reference/emails/send-email
 */
const fetch = require('node-fetch');

const RESEND_API = 'https://api.resend.com/emails';

function isResendReady() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function getResendFrom() {
  return (
    String(process.env.RESEND_FROM || '').trim() ||
    String(process.env.SMTP_FROM || '').trim() ||
    'GatorVault <onboarding@gatorvaultinsider.com>'
  );
}

function getResendReplyTo() {
  return (
    String(process.env.RESEND_REPLY_TO || process.env.EMAILJS_REPLY_TO || '').trim() ||
    'gatorvaultinsider@gmail.com'
  );
}

/**
 * @returns {{ id?: string, provider: 'resend' }}
 */
async function sendEmailViaResend({ to, subject, html, text } = {}) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  if (!to) throw new Error('Resend send requires to');
  if (!subject) throw new Error('Resend send requires subject');
  if (!html) throw new Error('Resend send requires html');

  const payload = {
    from: getResendFrom(),
    to: [String(to).trim()],
    subject: String(subject),
    html: String(html),
    reply_to: getResendReplyTo(),
  };
  if (text) payload.text = String(text);

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { raw };
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || raw || `HTTP ${res.status}`;
    throw new Error(`Resend failed (${res.status}): ${msg}`);
  }

  return { id: json?.id || null, provider: 'resend' };
}

module.exports = {
  isResendReady,
  getResendFrom,
  getResendReplyTo,
  sendEmailViaResend,
};
