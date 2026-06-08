/**
 * Server-side EmailJS send via raw REST POST (no SDK — no key-format validation).
 * https://www.emailjs.com/docs/rest-api/send/
 */

const { getEmailJsPublicKey, getEmailJsPrivateKey } = require('./emailjs-config');

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function buildEmailJsPayload({ serviceId, templateId, publicKey, templateParams, privateKey }) {
  return {
    service_id: String(serviceId).trim(),
    template_id: String(templateId).trim(),
    user_id: String(publicKey).trim(),
    accessToken: String(privateKey).trim(),
    template_params: templateParams
  };
}

async function sendEmailViaEmailJS({ serviceId, templateId, publicKey, templateParams, privateKey }) {
  const userId = publicKey != null ? String(publicKey).trim() : getEmailJsPublicKey();
  const token = privateKey != null ? String(privateKey).trim() : getEmailJsPrivateKey();

  if (!serviceId || !templateId || !userId || !token) {
    throw new Error('EmailJS server send requires serviceId, templateId, publicKey (user_id), and privateKey (accessToken)');
  }

  const payload = buildEmailJsPayload({
    serviceId,
    templateId,
    publicKey: userId,
    templateParams,
    privateKey: token
  });
  const payloadKeys = Object.keys(payload).sort();

  const res = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`EmailJS failed (${res.status}): ${text} [payload keys: ${payloadKeys.join(', ')}]`);
  }

  return { status: res.status, text, payloadKeys };
}

module.exports = { sendEmailViaEmailJS, buildEmailJsPayload, EMAILJS_SEND_URL };
