/**
 * EmailJS env config — Private Key Mode for server REST sends.
 * Server payload uses accessToken (private key) only — no user_id.
 * Public key env vars are optional (browser fallback only).
 */

const PUBLIC_PLACEHOLDERS = new Set(['', 'YOUR_PUBLIC_KEY_HERE']);
const PRIVATE_PLACEHOLDERS = new Set(['', 'YOUR_PRIVATE_KEY_HERE', 'your-emailjs-private-key-here']);

function trimEnv(name) {
  let value = process.env[name];
  if (value == null) return '';
  value = String(value).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/** Public key for REST `user_id` — no prefix/format validation. */
function getEmailJsPublicKey() {
  const fromUserId = trimEnv('EMAILJS_USER_ID');
  if (fromUserId && !PUBLIC_PLACEHOLDERS.has(fromUserId)) return fromUserId;

  const fromLegacy = trimEnv('EMAILJS_PUBLIC_KEY');
  if (fromLegacy && !PUBLIC_PLACEHOLDERS.has(fromLegacy)) return fromLegacy;

  return '';
}

function getEmailJsPrivateKey() {
  const key = trimEnv('EMAILJS_PRIVATE_KEY');
  if (!key || PRIVATE_PLACEHOLDERS.has(key)) return '';
  return key;
}

function getEmailJsServiceId() {
  return trimEnv('EMAILJS_SERVICE_ID');
}

function getEmailJsTemplateId() {
  return trimEnv('EMAILJS_TEMPLATE_ID');
}

function getEmailJsConfig() {
  return {
    serviceId: getEmailJsServiceId(),
    templateId: getEmailJsTemplateId(),
    publicKey: getEmailJsPublicKey(),
    privateKey: getEmailJsPrivateKey()
  };
}

function isEmailJsReady() {
  const { serviceId, templateId, privateKey } = getEmailJsConfig();
  return !!(serviceId && templateId && privateKey);
}

/** Safe hint for /api/email-status — first 4 chars only. */
function getEmailJsPublicKeyHint() {
  const key = getEmailJsPublicKey();
  return key ? `${key.slice(0, 4)}…` : null;
}

module.exports = {
  getEmailJsPublicKey,
  getEmailJsPrivateKey,
  getEmailJsServiceId,
  getEmailJsTemplateId,
  getEmailJsConfig,
  isEmailJsReady,
  getEmailJsPublicKeyHint
};
