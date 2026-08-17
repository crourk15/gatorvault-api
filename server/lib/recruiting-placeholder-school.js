const PLACEHOLDER_RECRUIT_SCHOOL = 'Florida HS pipeline';

const PLACEHOLDER_SKINNY_RE =
  /\bholds a florida offer\b|\bflorida hs pipeline\b|\bschool pending\b|\btbd\b|\bplaceholder\b/i;

/** Game-week / alert templates that must never sit on a recruit card skinny. */
const CORRUPT_RECRUIT_SKINNY_RE =
  /🐊\s*Florida\s+vs\.?\s*$|Florida\s+vs\.?\s*$|^[^—–-]{2,80}[—–-]\s*🐊/i;

function isPlaceholderSchool(school) {
  const s = String(school ?? '').trim().toLowerCase();
  return !s || s === 'florida hs pipeline' || s === 'florida hs pipelines';
}

function isCorruptRecruitSkinny(skinny) {
  const text = String(skinny ?? '').trim();
  if (!text) return false;
  return CORRUPT_RECRUIT_SKINNY_RE.test(text);
}

function isPlaceholderSkinny(skinny) {
  const text = String(skinny ?? '').trim();
  if (!text) return true;
  if (isCorruptRecruitSkinny(text)) return true;
  return PLACEHOLDER_SKINNY_RE.test(text);
}

function formatRecruitSchoolLabel(school) {
  if (isPlaceholderSchool(school)) return 'School pending';
  const trimmed = String(school ?? '').trim();
  return trimmed || null;
}

module.exports = {
  PLACEHOLDER_RECRUIT_SCHOOL,
  isPlaceholderSchool,
  isPlaceholderSkinny,
  isCorruptRecruitSkinny,
  formatRecruitSchoolLabel,
};
