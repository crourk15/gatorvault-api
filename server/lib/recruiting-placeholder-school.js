const PLACEHOLDER_RECRUIT_SCHOOL = 'Florida HS pipeline';

function isPlaceholderSchool(school) {
  const s = String(school ?? '').trim().toLowerCase();
  return !s || s === 'florida hs pipeline' || s === 'florida hs pipelines';
}

function formatRecruitSchoolLabel(school) {
  if (isPlaceholderSchool(school)) return 'School pending';
  const trimmed = String(school ?? '').trim();
  return trimmed || null;
}

module.exports = { PLACEHOLDER_RECRUIT_SCHOOL, isPlaceholderSchool, formatRecruitSchoolLabel };
