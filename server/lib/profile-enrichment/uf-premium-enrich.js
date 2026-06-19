/**
 * UF Premium profile enrichment — roster + recruiting JSON stores.
 */
const fs = require('fs');
const path = require('path');
const {
  templateForPosition,
  eligibilityYearsRemaining,
  positionGradeFromRating,
  fitScoreFromRating,
  nilValuationEstimate,
  injuryHistoryLabel,
  recruitingBackground,
  developmentProjection
} = require('./position-scouting-templates');

const ROOT = path.join(__dirname, '..', '..');
const ROSTER_PATH = path.join(ROOT, 'data', 'roster', 'players.json');
const RECRUITING_PATH = path.join(ROOT, 'data', 'recruiting', 'players.json');
const BREAKDOWNS_PATH = path.join(ROOT, 'data', 'war-room', 'breakdowns.json');
const ENRICHED_OVERRIDES = require('../../scripts/roster-enriched-overrides.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function enrichRosterPlayer(player) {
  const slug = player.slug;
  const override = ENRICHED_OVERRIDES[slug] || {};
  const template = templateForPosition(player.pos || player.position);
  const transfer = !!(player.transferInfo || player.transferHistory);
  const rating = player.displayRating ?? player.rating;

  const next = { ...player };

  if (!next.bio && override.bio) next.bio = override.bio;
  if (!next.stats && override.stats) next.stats = override.stats;
  if (!next.strengths?.length) next.strengths = override.strengths || [...template.strengths];
  if (!next.weaknesses?.length) next.weaknesses = override.weaknesses || [...template.weaknesses];
  if (!next.schemeFit) next.schemeFit = override.schemeFit || template.schemeFit;
  if (!next.projection) next.projection = developmentProjection(next, template);

  next.eligibilityYearsRemaining =
    next.eligibilityYearsRemaining ?? eligibilityYearsRemaining(next.class || next.year);
  next.transferStatus = next.transferStatus || (transfer ? 'Portal transfer' : 'High school / standard path');
  next.positionGrade = next.positionGrade || positionGradeFromRating(rating);
  next.fitScore = next.fitScore ?? fitScoreFromRating(rating, transfer);
  next.playerComp = next.playerComp || override.playerComp || null;
  next.developmentProjection = next.developmentProjection || next.projection;
  next.injuryHistory = next.injuryHistory || injuryHistoryLabel(next.injury);
  next.nilValuation = next.nilValuation ?? nilValuationEstimate(next);
  next.recruitingBackground = next.recruitingBackground || recruitingBackground(next);
  next.profileTier = next.profileTier || 'uf-premium';
  next.profileEnrichedAt = new Date().toISOString();

  return next;
}

function parseHtWt(htWt) {
  const raw = String(htWt || '');
  const m = raw.match(/(\d-\d+)\s*\/\s*(\d+)/);
  if (!m) return { height: null, weight: null };
  return { height: m[1], weight: m[2] };
}

function meterFromStatus(status, ufProbability) {
  if (status === 'committed' || status === 'commit') return 'hot';
  if (ufProbability != null && ufProbability >= 55) return 'hot';
  if (ufProbability != null && ufProbability >= 35) return 'warm';
  if (ufProbability != null && ufProbability > 0) return 'cool';
  return 'neutral';
}

function enrichRecruitingPlayer(player, breakdown, futurecastBySlug) {
  const slug = player.slug || player.id;
  const fc = futurecastBySlug.get(slug) || null;
  const next = { ...player };
  const parsed = parseHtWt(next.htWt);
  if (!next.height && parsed.height) next.height = parsed.height;
  if (!next.weight && parsed.weight) next.weight = parsed.weight;

  if (breakdown) {
    if (breakdown.strengths?.length) next.strengths = breakdown.strengths;
    if (breakdown.weaknesses?.length) next.weaknesses = breakdown.weaknesses;
    if (breakdown.schemeFit) next.schemeFit = breakdown.schemeFit;
    if (breakdown.projection) next.projection = breakdown.projection;
    if (breakdown.comparison) next.playerComp = breakdown.comparison;
    if (breakdown.insiderNotes) next.scoutingReport = breakdown.insiderNotes;
    if (breakdown.recruitingStory) next.recruitingStory = breakdown.recruitingStory;
    next.scoutingVerified = breakdown.verified === true;
  } else {
    const template = templateForPosition(next.pos || next.position);
    if (!next.strengths?.length) next.strengths = [...template.strengths];
    if (!next.weaknesses?.length) next.weaknesses = [...template.weaknesses];
    if (!next.schemeFit) next.schemeFit = template.schemeFit;
    if (!next.projection) next.projection = template.projection;
    if (!next.scoutingReport && next.skinny) next.scoutingReport = next.skinny;
  }

  const ufProb =
    fc?.ufProbability ??
    (next.ufProbability != null ? Number(next.ufProbability) : null);
  if (ufProb != null && ufProb > 0 && ufProb <= 1) {
    next.ufProbability = Math.round(ufProb * 100);
  } else if (ufProb != null) {
    next.ufProbability = Math.round(Number(ufProb));
  }

  next.fitScore = next.fitScore ?? fc?.fitScore ?? fitScoreFromRating(next.rating, false);
  next.futurecastProbability = next.ufProbability ?? fc?.ufProbability ?? null;
  next.pipelineState = next.pipelineState || fc?.pipelineState || next.status || 'target';
  next.interestMeter = next.interestMeter || meterFromStatus(next.status, next.ufProbability);
  next.positionGrade = next.positionGrade || positionGradeFromRating(next.rating);
  next.evaluationSummary =
    next.evaluationSummary ||
    `${next.stars || '—'}★ ${next.pos || ''} · #${next.natlRank || '—'} natl · ${next.school || ''}`.trim();
  next.profileTier = next.profileTier || 'uf-premium';
  next.profileEnrichedAt = new Date().toISOString();

  return next;
}

function loadFuturecastMap() {
  const map = new Map();
  try {
    const futurecastStore = require('../futurecast-store');
    const rows = futurecastStore.listAll?.() || futurecastStore.getAll?.() || [];
    for (const row of rows) {
      const slug = row.slug || row.playerSlug || row.id;
      if (slug) map.set(String(slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  return map;
}

function enrichAll(options = {}) {
  const dryRun = !!options.dryRun;
  const roster = readJson(ROSTER_PATH, []);
  const recruitingDoc = readJson(RECRUITING_PATH, []);
  const recruiting = Array.isArray(recruitingDoc) ? recruitingDoc : recruitingDoc.players || [];
  const breakdownDoc = readJson(BREAKDOWNS_PATH, { breakdowns: {} });
  const breakdowns = breakdownDoc.breakdowns || {};
  const futurecastBySlug = loadFuturecastMap();

  const enrichedRoster = roster.map(enrichRosterPlayer);
  const enrichedRecruiting = recruiting.map((p) => {
    const slug = String(p.slug || p.id || '').toLowerCase();
    return enrichRecruitingPlayer(p, breakdowns[slug], futurecastBySlug);
  });

  const summary = {
    roster: {
      total: enrichedRoster.length,
      withStrengths: enrichedRoster.filter((p) => p.strengths?.length).length,
      withFitScore: enrichedRoster.filter((p) => p.fitScore != null).length
    },
    recruiting: {
      total: enrichedRecruiting.length,
      byClass: enrichedRecruiting.reduce((acc, p) => {
        const y = String(p.classYear || '?');
        acc[y] = (acc[y] || 0) + 1;
        return acc;
      }, {}),
      withScoutingReport: enrichedRecruiting.filter((p) => p.scoutingReport).length,
      warRoomMerged: enrichedRecruiting.filter((p) => p.scoutingVerified).length
    },
    dryRun
  };

  if (!dryRun) {
    writeJson(ROSTER_PATH, enrichedRoster);
    writeJson(RECRUITING_PATH, enrichedRecruiting);
  }

  return summary;
}

module.exports = {
  enrichAll,
  enrichRosterPlayer,
  enrichRecruitingPlayer
};
