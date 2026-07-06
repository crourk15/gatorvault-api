/**
 * Block program/facility text from recruiting player identity resolution.
 */
const FACILITY_PHRASE_RES = [
  /\bben hill griffin(?:\s+stadium)?\b/i,
  /\bflorida gators football\b/i,
  /\bfloridagators\.com\b/i,
  /\banchored florida football since\b/i,
  /\bhome-?field edge sec foes\b/i,
  /\bone of college football(?:'s|’s)? loudest venues\b/i
];

const RECRUITING_SIGNAL_RE =
  /\b(?:recruit|visit|commit(?:ed|s)?|offer(?:ed|s)?|decommit|portal|official visit|unofficial visit|rpm|prediction|futurecast|4-?star|5-?star|top \d+|prospect|trip to|first trip)\b/i;

function normalizeForGuard(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isProgramFacilityText(text = '') {
  const t = normalizeForGuard(text);
  if (!t) return false;
  if (FACILITY_PHRASE_RES.some((re) => re.test(t))) return true;
  if (/^Florida Gators Football\b/i.test((t.split('\n')[0] || t))) return true;
  if (
    /\bthe swamp\b/i.test(t) &&
    /\b(?:loudest venues|anchored florida football|since 1930|home-?field edge)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

function isEvergreenOrProgramCandidate(candidate = {}) {
  const source = String(candidate?.source || '');
  if (source.includes('evergreen') || source.includes('program-history')) return true;
  if (candidate?.triggerType === 'program_news' || candidate?.programNewsType) return true;
  if (candidate?.validationMeta?.evergreen || candidate?.validationMeta?.programNews) return true;
  return false;
}

function isFacilityDerivedPlayerName(name = '', fullText = '') {
  const n = String(name || '').trim();
  const hay = String(fullText || '');
  if (!n) return false;
  if (/^ben hill griffin$/i.test(n)) return true;
  if (/^ben hill griffin stadium$/i.test(n)) return true;
  if (/\bben hill griffin\b/i.test(n) && /\bstadium\b/i.test(hay)) return true;
  return false;
}

function isBareSurnamePattern(patKey = '') {
  const tokens = String(patKey || '').split(' ').filter(Boolean);
  return tokens.length === 1;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseIncludesIdentityPattern(key = '', patKey = '') {
  const normalizedKey = String(key || '').trim();
  const normalizedPat = String(patKey || '').trim();
  if (!normalizedKey || !normalizedPat) return false;
  if (normalizedKey === normalizedPat) return !isProgramFacilityText(normalizedKey);

  if (isBareSurnamePattern(normalizedPat)) {
    if (isProgramFacilityText(normalizedKey)) return false;
    if (/\bben hill griffin\b/i.test(normalizedKey)) return false;
    const re = new RegExp('\\b' + escapeRegExp(normalizedPat) + '\\b', 'i');
    return re.test(normalizedKey);
  }

  return normalizedKey.includes(normalizedPat) || normalizedPat.includes(normalizedKey);
}

function hasUfRecruitingSignal(text = '') {
  const t = normalizeForGuard(text);
  if (!t) return false;
  if (isProgramFacilityText(t)) return false;

  const hasUf = /\b(?:florida|gators|\buf\b|gainesville)\b/i.test(t);
  if (!hasUf && !/\b(?:swamp|the swamp)\b/i.test(t)) return false;

  if (/\b20(?:2[7-9]|3[0-2])\b/.test(t)) return true;
  if (RECRUITING_SIGNAL_RE.test(t)) return true;
  if (/\b(?:swamp|gainesville|the swamp)\b/i.test(t) && RECRUITING_SIGNAL_RE.test(t)) return true;
  if (/\b(?:commitment date|sets commitment|commit date)\b/i.test(t)) return true;
  if (/\b(?:flip targets|pending decisions|2028 class|recruiting storyline)\b/i.test(t)) return true;
  if (/\b(?:friday night lights|\bfnl\b)\b/i.test(t) && RECRUITING_SIGNAL_RE.test(t)) return true;

  return false;
}

function shouldBlockDetectivesHandoff(payload = {}) {
  const cand = payload?.candidate || {};
  if (isEvergreenOrProgramCandidate(cand)) return true;
  const text = String(
    payload?.beatPost?.text ||
      payload?.beatPost?.summary ||
      cand?.beatText ||
      cand?.text ||
      cand?.triggerPhrase ||
      payload?.hints?.beatText ||
      ''
  ).trim();
  if (isProgramFacilityText(text)) return true;
  return false;
}

module.exports = {
  FACILITY_PHRASE_RES,
  isProgramFacilityText,
  isEvergreenOrProgramCandidate,
  isFacilityDerivedPlayerName,
  isBareSurnamePattern,
  phraseIncludesIdentityPattern,
  hasUfRecruitingSignal,
  shouldBlockDetectivesHandoff
};