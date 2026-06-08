/**
 * Server-side EmailJS send via raw REST POST (no SDK).
 * https://www.emailjs.com/docs/rest-api/send/
 */

const fetch = require('node-fetch');
const {
  getEmailJsPublicKey,
  getEmailJsPrivateKey,
  getEmailJsServiceId,
  getEmailJsTemplateId
} = require('./emailjs-config');

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function buildEmailJsPayload({ serviceId, templateId, publicKey, templateParams, privateKey }) {
  return {
    service_id: String(serviceId).trim(),
    template_id: String(templateId).trim(),
    user_id: String(publicKey).trim(),
    accessToken: String(privateKey).trim(),
    template_params: templateParams || {}
  };
}

async function sendEmailViaEmailJS({ serviceId, templateId, publicKey, templateParams, privateKey }) {
  const resolvedServiceId = serviceId || getEmailJsServiceId();
  const resolvedTemplateId = templateId || getEmailJsTemplateId();
  const userId = publicKey != null ? String(publicKey).trim() : getEmailJsPublicKey();
  const token = privateKey != null ? String(privateKey).trim() : getEmailJsPrivateKey();

  if (!resolvedServiceId || !resolvedTemplateId || !userId || !token) {
    throw new Error('EmailJS server send requires serviceId, templateId, publicKey (user_id), and privateKey (accessToken)');
  }

  const payload = buildEmailJsPayload({
    serviceId: resolvedServiceId,
    templateId: resolvedTemplateId,
    publicKey: userId,
    templateParams,
    privateKey: token
  });
  const payloadKeys = Object.keys(payload).sort();
  const paramKeys = Object.keys(payload.template_params || {}).sort();

  console.log('[emailjs] POST', EMAILJS_SEND_URL, {
    service_id: payload.service_id,
    template_id: payload.template_id,
    user_id_hint: `${userId.slice(0, 4)}… (${userId.length} chars)`,
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
    return 'Public and private keys must be from the same EmailJS account — update EMAILJS_USER_ID and EMAILJS_PRIVATE_KEY on Render';
  }
  if (status === 403 || body.includes('non-browser')) {
    return 'Enable Allow EmailJS API for non-browser applications in EmailJS → Account → Security';
  }
  if (body.includes('public key is invalid') || body.includes('public key is required')) {
    return 'Check EMAILJS_USER_ID matches your EmailJS dashboard Public Key exactly';
  }
  return '';
}

/** Lightweight connectivity check — does not deliver email content. */
async function probeEmailJsAccount() {
  try {
    const payload = buildEmailJsPayload({
      serviceId: getEmailJsServiceId(),
      templateId: getEmailJsTemplateId(),
      publicKey: getEmailJsPublicKey(),
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
