/** PR-9 — brand voice / energy without predicting outcomes. */

const BRAND_BANNED = [
  /\bwill end in uf landing\b/i,
  /\bwill land him\b/i,
  /\bflorida will get him\b/i,
  /\bthis ends with uf\b/i,
  /\bflorida is tracking\b/i,
  /\bmade a big impression\b/i,
  /\bstrong early spot\b/i
];

const BRAND_REQUIRED_MARKERS = [
  'momentum',
  'energy',
  'traction',
  'widening',
  'capitalize',
  'keep an eye',
  'building real',
  'positioned',
  'staff',
  'board'
];

function buildBrandVoiceLine(pr6Pack = {}) {
  const combined = `${pr6Pack.narrative1 || ''} ${pr6Pack.narrative2 || ''}`.toLowerCase();

  if (/lane|widen|widening/i.test(combined)) {
    return {
      template: 'lane_widening',
      clause: 'that lane is widening, and UF is positioned to capitalize'
    };
  }
  if (/traction|foothold|lean/i.test(combined)) {
    return {
      template: 'momentum',
      clause: 'this is the kind of early traction that turns into real momentum'
    };
  }
  return {
    template: 'energy',
    clause: 'Florida is building real energy in this recruitment'
  };
}

function validateBrandVoiceLine(text) {
  const violations = [];
  const lower = String(text || '').toLowerCase();

  for (const re of BRAND_BANNED) {
    if (re.test(lower)) violations.push({ type: 'brand_banned_phrase', pattern: re.source });
  }

  const hasMarker = BRAND_REQUIRED_MARKERS.some((m) => lower.includes(m));
  if (!hasMarker) violations.push({ type: 'missing_brand_voice' });

  return { ok: violations.length === 0, violations, hasMarker };
}

module.exports = {
  buildBrandVoiceLine,
  validateBrandVoiceLine,
  BRAND_BANNED,
  BRAND_REQUIRED_MARKERS
};
