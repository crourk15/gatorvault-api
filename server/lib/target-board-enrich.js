/**
 * Merge locked target-board seed (UF %, fit, ranks, school) into recruiting board rows.
 * Keeps Recruiting Hub 2028 targets aligned with FutureCast high-priority / allowlist data.
 */
const { slugify } = require('./slug');
const { loadTargetBoardBySlug } = require('./target-board-path');

const BOARD_YEARS = new Set([2027, 2028]);

function firstPositive(...values) {
  for (const raw of values) {
    if (raw == null || !Number.isFinite(Number(raw))) continue;
    if (Number(raw) > 0) return Number(raw);
  }
  return null;
}

/** Normalize UF likelihood to 0-1 fraction for ClassicRecruitCard. */
function toUfFraction(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  if (n <= 0) return null;
  return n <= 1 ? n : n / 100;
}

function mergeBoardSeed(player, boardRow, classYear) {
  if (!boardRow) return player;

  const slug = String(player.slug || boardRow.slug || slugify(player.name || boardRow.name || '')).toLowerCase();
  const merged = { ...player, slug: player.slug || boardRow.slug || slug };

  if (!merged.name && boardRow.name) merged.name = boardRow.name;
  if (!merged.pos && !merged.position && (boardRow.pos || boardRow.position)) {
    merged.pos = boardRow.pos || boardRow.position;
  }
  if (!merged.school && boardRow.school) merged.school = boardRow.school;
  if (!merged.state && boardRow.state) merged.state = boardRow.state;
  if (merged.inState == null && boardRow.inState != null) merged.inState = boardRow.inState;

  merged.stars = firstPositive(merged.stars, boardRow.stars) ?? merged.stars;
  merged.rating = firstPositive(merged.rating, merged.displayRating, boardRow.rating) ?? merged.rating;
  merged.displayRating = firstPositive(merged.displayRating, merged.rating, boardRow.rating) ?? merged.displayRating;
  merged.natlRank = firstPositive(merged.natlRank, merged.natl, boardRow.natlRank) ?? merged.natlRank;
  merged.natl = merged.natlRank ?? merged.natl;
  merged.posRank = firstPositive(merged.posRank, boardRow.posRank) ?? merged.posRank;
  merged.stateRank = firstPositive(merged.stateRank, boardRow.stateRank) ?? merged.stateRank;

  if (!merged.skinny && boardRow.skinny) merged.skinny = boardRow.skinny;
  if (merged.headliner == null && boardRow.headliner != null) merged.headliner = boardRow.headliner;

  const ufFraction =
    toUfFraction(merged.ufProbability) ??
    toUfFraction(merged.futurecastProbability) ??
    toUfFraction(boardRow.ufProbability);
  if (ufFraction != null) merged.ufProbability = ufFraction;

  let fitScore = firstPositive(merged.fitScore, merged.ufFitScore, boardRow.fitScore, boardRow.ufFitScore);
  if (fitScore == null && BOARD_YEARS.has(classYear)) {
    try {
      const { buildUfFitSeedProfile } = require('./uf-fit-score-seed');
      const profile = buildUfFitSeedProfile({
        playerId: slug,
        slug,
        classYear,
        state: String(merged.state || boardRow.state || ''),
        targetSeed: boardRow,
        recruiting: merged,
        modelPred: null,
      });
      fitScore = profile?.uf_fit_score;
    } catch {
      /* optional seed */
    }
  }
  if (fitScore != null) merged.fitScore = Math.round(Number(fitScore));

  return merged;
}

function synthesizeFromBoard(boardRow, classYear) {
  const slug = String(boardRow.slug || '').toLowerCase();
  if (!slug) return null;
  return mergeBoardSeed(
    {
      slug,
      name: boardRow.name || slug,
      pos: boardRow.pos || boardRow.position || null,
      classYear,
      category: 'target',
      status: 'uncommitted',
    },
    boardRow,
    classYear
  );
}

function enrichTargetsWithBoardSeed(targets, classYear, allowlist) {
  const year = parseInt(classYear, 10);
  if (!BOARD_YEARS.has(year)) return targets || [];

  const boardBySlug = loadTargetBoardBySlug(year);
  const merged = (targets || []).map((p) => {
    const slug = String(p.slug || slugify(p.name || '')).toLowerCase();
    return mergeBoardSeed(p, boardBySlug.get(slug), year);
  });

  const present = new Set(merged.map((p) => String(p.slug || '').toLowerCase()).filter(Boolean));
  const allowSet = allowlist?.getAllowlistSet?.(year);
  if (allowSet?.size) {
    for (const slug of allowSet) {
      if (present.has(slug)) continue;
      const boardRow = boardBySlug.get(slug);
      if (!boardRow) continue;
      const synth = synthesizeFromBoard(boardRow, year);
      if (synth) merged.push(synth);
    }
  }

  return merged;
}

module.exports = {
  enrichTargetsWithBoardSeed,
  mergeBoardSeed,
  toUfFraction,
};
