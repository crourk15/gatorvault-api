/**
 * EmailJS env config — accepts any key format (legacy or new short-format public keys).
 * Keys are trimmed and passed verbatim to the REST API as user_id / accessToken.
 */

const PUBLIC_PLACEHOLDERS = new Set(['', 'YOUR_PUBLIC_KEY_HERE']);
const PRIVATE_PLACEHOLDERS = new Set(['', 'YOUR_PRIVATE_KEY_HERE', 'your-emailjs-private-key-here']);

function trimEnv(name) {
  const value = process.env[name];
  return value == null ? '' : String(value).trim();
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
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
  return !!(serviceId && templateId && publicKey && privateKey);
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
