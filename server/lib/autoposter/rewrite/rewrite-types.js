/** PR-6 — constants and env flags. */

const CHAR_LIMIT = parseInt(process.env.VOICE_CHAR_LIMIT || '280', 10);
const MAX_REWRITE_ATTEMPTS = 3;

const GENERIC_BANNED = [
  /\bflorida is in a strong early spot\b/i,
  /\bflorida made a big impression\b/i,
  /\bflorida is tracking\b/i,
  /\bflorida is using campus time to test fit\b/i,
  /\bspending staff capital early after the visit landed\b/i,
  /\bthe gators want more face time\b/i,
  /\bsaid florida\b/i,
  /\btold on3 the gators are one of his top schools\b/i,
  /\bwas on campus this spring for florida's spring practice\b/i,
  /\bimpressed florida on his first trip\b/i
];

const MECHANICAL_BANNED = [
  /\bsaid ["']/i,
  /\btold reporters\b/i,
  /\btold on3\b/i,
  /\b\d{4}\s+cb\b/i
];

const INSIDER_VOCAB = [
  'lane',
  'board',
  'traction',
  'lean',
  'leaned',
  'separation',
  'capital',
  'foothold',
  'positioned',
  'pressing',
  'responded',
  'momentum',
  'cycle',
  'staff',
  'visit',
  'board movement',
  'early',
  'eval',
  'path',
  'climbing',
  'gaining',
  'widening',
  'opened',
  'pushed',
  'firmly'
];

function isPr6ShadowMode() {
  return process.env.X_AUTOPOST_PR6_SHADOW !== 'false';
}

function isPr6Enabled() {
  return process.env.X_AUTOPOST_PR6_ENABLED === 'true';
}

function isPr789ShadowMode() {
  return process.env.X_AUTOPOST_PR7_8_9_SHADOW !== 'false';
}

function isPr789Enabled() {
  return process.env.X_AUTOPOST_PR7_8_9_ENABLED === 'true';
}

function isPr789AngleShadowMode() {
  return process.env.X_AUTOPOST_PR789_ANGLE_SHADOW !== 'false';
}

function isPr789AngleEnabled() {
  return process.env.X_AUTOPOST_PR789_ANGLE_ENABLED === 'true';
}

module.exports = {
  CHAR_LIMIT,
  MAX_REWRITE_ATTEMPTS,
  GENERIC_BANNED,
  MECHANICAL_BANNED,
  INSIDER_VOCAB,
  isPr6ShadowMode,
  isPr6Enabled,
  isPr789ShadowMode,
  isPr789Enabled,
  isPr789AngleShadowMode,
  isPr789AngleEnabled
};
