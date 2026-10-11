const PLACEHOLDER_RECRUIT_SCHOOL = 'Florida HS pipeline';

const PLACEHOLDER_SKINNY_RE =
  /\bholds a florida offer\b|\bflorida hs pipeline\b|\bschool pending\b|\btbd\b|\bplaceholder\b/i;

function isPlaceholderSchool(school) {
  const s = String(school ?? '').trim().toLowerCase();
  return !s || s === 'florida hs pipeline' || s === 'florida hs pipelines';
}

function isPlaceholderSkinny(skinny) {
  const text = String(skinny ?? '').trim();
  if (!text) return true;
  return PLACEHOLDER_SKINNY_RE.test(text);
}

function formatRecruitSchoolLabel(school) {
  if (isPlaceholderSchool(school)) return 'School pending';
  const trimmed = String(school ?? '').trim();
  return trimmed || null;
}

/** College nicknames that got stored in the high-school field (Easton Royal → Texas). */
const COLLEGE_PLEDGE_RE =
  /^(?:texas|florida|lsu|alabama|georgia|ohio state|miami|ole miss|auburn|tennessee|oregon|michigan|notre dame|clemson|usc|oklahoma|penn state|florida state|texas a&m|texas tech|south carolina)(?:\s+(?:longhorns|gators|tigers|bulldogs|buckeyes|hurricanes|rebels|crimson tide|fighting irish|nittany lions|seminoles|aggies|red raiders|trojans|sooners|volunteers|wolverines|ducks|gamecocks))?$/i;

function schoolIsCollegePledge(school) {
  const s = String(school ?? '').trim();
  if (!s) return false;
  if (/^university of\b/i.test(s)) return true;
  return COLLEGE_PLEDGE_RE.test(s);
}

module.exports = {
  PLACEHOLDER_RECRUIT_SCHOOL,
  isPlaceholderSchool,
  isPlaceholderSkinny,
  formatRecruitSchoolLabel,
  schoolIsCollegePledge,
};
