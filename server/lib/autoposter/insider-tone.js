/**
 * GatorVault Insider Tone Guide — enforced on every rewrite before posting.
 */
const FORBIDDEN_TONE_PATTERNS = [
  /\bomg\b/i,
  /\bhuge news\b/i,
  /\bmassive\b/i,
  /\binsane\b/i,
  /\bcrazy\b/i,
  /\bbreaking:\s*/i,
  /\bbreaking\b/i,
  /\blocked in\b/i,
  /\bdone deal\b/i,
  /\bhe loved the visit\b/i,
  /\bshe loved the visit\b/i,
  /\b!!!+/,
  /\baccording to gm2\b/i,
  /\bgm2\b/i
];

const GENERIC_FLUFF_PATTERNS = [
  /^had a great visit\.?$/i,
  /^great visit\.?$/i,
  /^loved the visit\.?$/i,
  /^amazing visit\.?$/i,
  /^florida is actively tracking/i,
  /^more clarity expected soon/i
];

const PREFERRED_PHRASE_HINTS = [
  'quietly gaining traction',
  'strengthened their position',
  'UF is in a favorable spot',
  'staff confidence is growing',
  'momentum is shifting',
  'UF is trending upward',
  'quietly strengthened its position',
  'staff feels good about where things stand',
  'firmly in the top group'
];

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function violatesInsiderTone(text) {
  const t = String(text || '').trim();
  if (!t) return { fail: true, reason: 'empty_text' };
  for (const re of FORBIDDEN_TONE_PATTERNS) {
    if (re.test(t)) return { fail: true, reason: 'forbidden_tone', pattern: re.source };
  }
  return { fail: false };
}

function isGenericFluff(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (t.length < 40 && GENERIC_FLUFF_PATTERNS.some((re) => re.test(t))) return true;
  return GENERIC_FLUFF_PATTERNS.some((re) => re.test(t));
}

function hasInsiderPhrasing(text) {
  const lower = String(text || '').toLowerCase();
  return PREFERRED_PHRASE_HINTS.some((phrase) => lower.includes(phrase));
}

function validateInsiderTone(text, { minWords = 40 } = {}) {
  const errors = [];
  const words = countWords(text);
  if (words < minWords) errors.push('too_short');
  const tone = violatesInsiderTone(text);
  if (tone.fail) errors.push(tone.reason);
  if (isGenericFluff(text)) errors.push('generic_fluff');
  return { ok: errors.length === 0, errors, wordCount: words };
}

function getToneGuide() {
  return {
    characteristics: [
      'confident',
      'informed',
      'subtle',
      'analytical',
      'calm',
      'professional',
      'insider-level'
    ],
    preferredPhrases: PREFERRED_PHRASE_HINTS,
    forbiddenPatterns: FORBIDDEN_TONE_PATTERNS.map((re) => re.source),
    minWords: 40
  };
}

module.exports = {
  FORBIDDEN_TONE_PATTERNS,
  GENERIC_FLUFF_PATTERNS,
  PREFERRED_PHRASE_HINTS,
  countWords,
  violatesInsiderTone,
  isGenericFluff,
  hasInsiderPhrasing,
  validateInsiderTone,
  getToneGuide
};
