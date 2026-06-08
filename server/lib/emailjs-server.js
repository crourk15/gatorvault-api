/**
 * Server-side EmailJS send — private key only, no public key / user_id.
 * Do NOT use @emailjs/nodejs here; its SDK always requires publicKey and sets user_id.
 */

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

async function sendEmailViaEmailJS({ serviceId, templateId, templateParams, privateKey }) {
  if (!serviceId || !templateId || !privateKey) {
    throw new Error('EmailJS server send requires serviceId, templateId, and privateKey');
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    access_token: privateKey,
    template_params: templateParams
  };

  const res = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`EmailJS failed (${res.status}): ${text}`);
  }

  return { status: res.status, text };
}

module.exports = { sendEmailViaEmailJS, EMAILJS_SEND_URL };
