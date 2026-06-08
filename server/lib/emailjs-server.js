/**
 * Server-side EmailJS send via raw REST POST (no SDK).
 * Private Key Mode: accessToken only — do NOT send user_id (public key).
 * https://www.emailjs.com/docs/rest-api/send/
 */

const fetch = require('node-fetch');
const {
  getEmailJsPrivateKey,
  getEmailJsServiceId,
  getEmailJsTemplateId
} = require('./emailjs-config');

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function buildEmailJsPayload({ serviceId, templateId, templateParams, privateKey }) {
  const token = String(privateKey || '').trim();
  return {
    service_id: String(serviceId).trim(),
    template_id: String(templateId).trim(),
    accessToken: token,
    template_params: templateParams || {}
  };
}

async function sendEmailViaEmailJS({ serviceId, templateId, templateParams, privateKey }) {
  const resolvedServiceId = serviceId || getEmailJsServiceId();
  const resolvedTemplateId = templateId || getEmailJsTemplateId();
  const token = privateKey != null ? String(privateKey).trim() : getEmailJsPrivateKey();

  if (!resolvedServiceId || !resolvedTemplateId || !token) {
    throw new Error('EmailJS server send requires serviceId, templateId, and privateKey (accessToken)');
  }

  const payload = buildEmailJsPayload({
    serviceId: resolvedServiceId,
    templateId: resolvedTemplateId,
    templateParams,
    privateKey: token
  });
  const payloadKeys = Object.keys(payload).sort();
  const paramKeys = Object.keys(payload.template_params || {}).sort();

  console.log('[emailjs] POST', EMAILJS_SEND_URL, {
    mode: 'private-key',
    service_id: payload.service_id,
    template_id: payload.template_id,
    accessToken_hint: `${token.slice(0, 4)}… (${token.length} chars)`,
    template_param_keys: paramKeys
  });

  const res = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  const result = {
    contacted: true,
    status: res.status,
    text,
    payloadKeys,
    paramKeys
  };

  if (!res.ok) {
    const hint = emailJsErrorHint(res.status, text);
    throw new Error(`EmailJS failed (${res.status}): ${text}${hint ? ` — ${hint}` : ''} [payload keys: ${payloadKeys.join(', ')}]`);
  }

  console.log('[emailjs] OK', res.status, text.slice(0, 80));
  return result;
}

function emailJsErrorHint(status, text) {
  const body = String(text || '').toLowerCase();
  if (status === 404 || body.includes('account not found')) {
    return 'Private Key Mode: use accessToken only (no user_id). Check EMAILJS_PRIVATE_KEY and service/template IDs';
  }
  if (status === 403 || body.includes('non-browser')) {
    return 'Enable Allow EmailJS API for non-browser applications in EmailJS → Account → Security';
  }
  if (body.includes('public key is invalid') || body.includes('public key is required')) {
    return 'Account may be in Private Key Mode — server must not send user_id; set EMAILJS_PRIVATE_KEY only';
  }
  return '';
}

/** Lightweight connectivity check — does not deliver email content. */
async function probeEmailJsAccount() {
  try {
    const payload = buildEmailJsPayload({
      serviceId: getEmailJsServiceId(),
      templateId: getEmailJsTemplateId(),
      privateKey: getEmailJsPrivateKey(),
      templateParams: { email: 'probe@example.com', name: 'Probe', tier: 'Film Room' }
    });
    const res = await fetch(EMAILJS_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    return {
      contacted: true,
      ok: res.ok,
      status: res.status,
      text: text.slice(0, 200),
      hint: res.ok ? null : emailJsErrorHint(res.status, text)
    };
  } catch (err) {
    return { contacted: false, ok: false, error: err.message };
  }
}

module.exports = {
  sendEmailViaEmailJS,
  buildEmailJsPayload,
  probeEmailJsAccount,
  emailJsErrorHint,
  EMAILJS_SEND_URL
};
