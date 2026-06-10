/**
 * Cycle separation — 2027+ recruiting vs 2026 program team coverage.
 */
const RECRUITING_MIN_CLASS = 2027;
const PROGRAM_MIN_SEASON = 2026;

const RECRUITING_CATEGORIES = new Set([
  'heat_check',
  'official_visit_preview',
  'post_visit_reaction'
]);

const PROGRAM_CATEGORIES = new Set([
  'program_pulse',
  'summer_preview',
  'depth_chart_movement',
  'roster_analysis',
  'game_week_preview',
  'staff_intel'
]);

function parseYear(val) {
  if (val == null || val === '') return null;
  const n = parseInt(String(val).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 2000 && n <= 2040 ? n : null;
}

function isRecruitingCategory(category) {
  return RECRUITING_CATEGORIES.has(String(category || '').toLowerCase());
}

function isProgramCategory(category) {
  return PROGRAM_CATEGORIES.has(String(category || '').toLowerCase());
}

function isRecruitingClassPlayer(player) {
  const y = parseYear(player?.classYear ?? player?.class);
  return y != null && y >= RECRUITING_MIN_CLASS;
}

function isRecruitingClassIntel(intel) {
  const y = parseYear(intel?.classYear);
  if (y == null) return false;
  return y >= RECRUITING_MIN_CLASS;
}

function isRecruitingClassHeatItem(item) {
  const y = parseYear(item?.classYear);
  if (y == null) return false;
  return y >= RECRUITING_MIN_CLASS;
}

function isRecruitingClassEvent(event) {
  const y = parseYear(event?.classYear ?? event?.payload?.player?.classYear);
  if (y == null) return false;
  return y >= RECRUITING_MIN_CLASS;
}

/** Skip intel before article generation. */
function passesCycleGate({ cycleType, classYear, programSeason } = {}) {
  if (cycleType === 'recruiting') {
    const y = parseYear(classYear);
    return y != null && y >= RECRUITING_MIN_CLASS;
  }
  if (cycleType === 'program') {
    const y = parseYear(programSeason);
    if (y == null) return true;
    return y >= PROGRAM_MIN_SEASON;
  }
  return false;
}

function filterRecruitingPlayers(players) {
  return (players || []).filter(isRecruitingClassPlayer);
}

function filterRecruitingIntel(intel) {
  return (intel || []).filter(isRecruitingClassIntel);
}

function filterRecruitingHeat(rising) {
  return (rising || []).filter(isRecruitingClassHeatItem);
}

function filterRecruitingEvents(events) {
  return (events || []).filter(isRecruitingClassEvent);
}

function programSeasonYear() {
  return PROGRAM_MIN_SEASON;
}

module.exports = {
  RECRUITING_MIN_CLASS,
  PROGRAM_MIN_SEASON,
  RECRUITING_CATEGORIES,
  PROGRAM_CATEGORIES,
  parseYear,
  isRecruitingCategory,
  isProgramCategory,
  isRecruitingClassPlayer,
  isRecruitingClassIntel,
  isRecruitingClassHeatItem,
  isRecruitingClassEvent,
  passesCycleGate,
  filterRecruitingPlayers,
  filterRecruitingIntel,
  filterRecruitingHeat,
  filterRecruitingEvents,
  programSeasonYear
};
