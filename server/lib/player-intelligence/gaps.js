const { STALE_RANKINGS_MS, STALE_RPM_MS } = require('./constants');

function parseTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function offersCompleteness(offers = []) {
  const list = Array.isArray(offers) ? offers : [];
  const hasUf = list.some((o) => /florida|\bgators\b|\buf\b/i.test(String(o.school || '')));
  return {
    count: list.length,
    complete: list.length > 0,
    hasUf,
    sources: [...new Set(list.map((o) => o.source).filter(Boolean))]
  };
}

function visitsCompleteness(visits = []) {
  const list = Array.isArray(visits) ? visits : [];
  const hasOfficial = list.some((v) => {
    const type = String(v.visitType || '').trim().toLowerCase();
    return /\bofficial\b/i.test(type) && !/unofficial/i.test(type);
  });
  const latestDate = list.length ? list[0]?.visitDate || null : null;
  return {
    count: list.length,
    complete: list.length > 0,
    hasOfficial,
    latestDate,
    sources: [...new Set(list.map((v) => v.source).filter(Boolean))]
  };
}

function detectGaps(intel = {}) {
  const gaps = [];
  const player = intel.identity || {};
  const rankingBlock = intel.rankingBlock;
  const offers = offersCompleteness(intel.offers);
  const visits = visitsCompleteness(intel.visits);

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

  if (!offers.complete) gaps.push('no_offers');
  else if (!offers.hasUf) gaps.push('offers_missing_uf');

  if (!visits.complete) gaps.push('no_visits');
  else if (!visits.hasOfficial) gaps.push('visits_missing_official');

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

module.exports = { detectGaps, detectStale, offersCompleteness, visitsCompleteness };
