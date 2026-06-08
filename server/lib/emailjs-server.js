/**
 * Server-side EmailJS send via REST API (no @emailjs/nodejs SDK).
 * Required REST fields per https://www.emailjs.com/docs/rest-api/send/ :
 *   service_id, template_id, user_id (account public key), accessToken (private key), template_params
 */

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function buildEmailJsPayload({ serviceId, templateId, userId, templateParams, privateKey }) {
  return {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    accessToken: privateKey,
    template_params: templateParams
  };
}

async function sendEmailViaEmailJS({ serviceId, templateId, userId, templateParams, privateKey }) {
  if (!serviceId || !templateId || !userId || !privateKey) {
    throw new Error('EmailJS server send requires serviceId, templateId, userId, and privateKey');
  }

  const payload = buildEmailJsPayload({ serviceId, templateId, userId, templateParams, privateKey });
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
