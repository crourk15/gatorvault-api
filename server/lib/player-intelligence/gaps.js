const { STALE_RANKINGS_MS, STALE_RPM_MS } = require('./constants');

function parseTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function detectGaps(intel = {}) {
  const gaps = [];
  const player = intel.identity || {};
  const rankingBlock = intel.rankingBlock;

  if (!player.name) gaps.push('missing_name');
  if (!player.classYear) gaps.push('missing_class_year');
  if (!player.pos && !player.position) gaps.push('missing_position');
  if (!player.on3Id && !player.on3Slug) gaps.push('missing_on3_link');

  if (!rankingBlock?.valid) {
    gaps.push('incomplete_rankings');
    const on3 = intel.rankingBlocks?.on3;
    if (on3 && !on3.valid) {
      if (!player.stars) gaps.push('missing_on3_stars');
      if (!player.natlRank) gaps.push('missing_on3_national_rank');
      if (!player.posRank) gaps.push('missing_on3_position_rank');
      if (!player.stateRank) gaps.push('missing_on3_state_rank');
    }
  }

  if (!Array.isArray(intel.offers) || !intel.offers.length) gaps.push('no_offers');
  if (!Array.isArray(intel.visits) || !intel.visits.length) gaps.push('no_visits');
  if (intel.rpm?.ufPct == null || Number(intel.rpm.ufPct) <= 0) gaps.push('no_rpm');

  return [...new Set(gaps)];
}

function detectStale(intel = {}) {
  const stale = [];
  const now = Date.now();
  const rankingObs = parseTime(intel.rankingBlock?.observedAt || intel.identity?.updatedAt);
  if (rankingObs && now - rankingObs > STALE_RANKINGS_MS) {
    stale.push('rankings_stale');
  }
  const rpmObs = parseTime(intel.rpm?.observedAt);
  if (rpmObs && now - rpmObs > STALE_RPM_MS) {
    stale.push('rpm_stale');
  }
  return stale;
}

module.exports = { detectGaps, detectStale };
