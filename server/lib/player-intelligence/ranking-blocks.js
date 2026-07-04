/**
 * Single-source ranking blocks — never blend sources in one token set.
 */
const { extractOn3RankingTokens } = require('../autoposter/on3-ranking-tokens');

function parseObservedAt(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function buildOn3RankingBlock(player = {}) {
  const tokens = extractOn3RankingTokens(player);
  const observedAt = parseObservedAt(player.updatedAt || player.vaultGradeUpdatedAt);
  const sourceUrl = player.on3ProfileUrl || player.on3Slug || null;
  if (!tokens) {
    return {
      source: 'on3',
      valid: false,
      observedAt,
      sourceUrl: sourceUrl ? String(sourceUrl) : null
    };
  }
  return {
    source: 'on3',
    valid: true,
    ...tokens,
    observedAt,
    sourceUrl: sourceUrl ? String(sourceUrl) : null
  };
}

/** Rivals block — only explicit Rivals-sourced fields (Phase 2 connector fills these). */
function buildRivalsRankingBlock(player = {}) {
  const tokens = extractOn3RankingTokens({
    stars: player.rivalsStars,
    natlRank: player.rivalsNatlRank,
    posRank: player.rivalsPosRank,
    stateRank: player.rivalsStateRank
  });
  if (!tokens) {
    return { source: 'rivals', valid: false, observedAt: null, sourceUrl: player.rivalsArticleUrl || null };
  }
  return {
    source: 'rivals',
    valid: true,
    on3Stars: tokens.on3Stars,
    on3NationalRank: tokens.on3NationalRank,
    on3PositionRank: tokens.on3PositionRank,
    on3StateRank: tokens.on3StateRank,
    observedAt: parseObservedAt(player.rivalsRankUpdatedAt || player.updatedAt),
    sourceUrl: player.rivalsArticleUrl || null
  };
}

/** ESPN block — only explicit ESPN-sourced fields (Phase 2). */
function buildEspnRankingBlock(player = {}) {
  const tokens = extractOn3RankingTokens({
    stars: player.espnStars,
    natlRank: player.espnNatlRank,
    posRank: player.espnPosRank,
    stateRank: player.espnStateRank
  });
  if (!tokens) {
    return { source: 'espn', valid: false, observedAt: null, sourceUrl: player.espnProfileUrl || null };
  }
  return {
    source: 'espn',
    valid: true,
    on3Stars: tokens.on3Stars,
    on3NationalRank: tokens.on3NationalRank,
    on3PositionRank: tokens.on3PositionRank,
    on3StateRank: tokens.on3StateRank,
    observedAt: parseObservedAt(player.espnRankUpdatedAt || player.updatedAt),
    sourceUrl: player.espnProfileUrl || null
  };
}

function buildAllRankingBlocks(player = {}) {
  return {
    on3: buildOn3RankingBlock(player),
    rivals: buildRivalsRankingBlock(player),
    espn: buildEspnRankingBlock(player)
  };
}

/** Primary: On3 → Rivals → ESPN. One block only — no mixing. */
function selectRankingBlock(blocks = {}) {
  for (const source of ['on3', 'rivals', 'espn']) {
    const block = blocks[source];
    if (block?.valid === true) return block;
  }
  return null;
}

/** PR-789 backward-compat shape when block is valid. */
function rankingTokensFromBlock(block) {
  if (!block?.valid) return null;
  return {
    source: block.source,
    on3Stars: block.on3Stars,
    on3NationalRank: block.on3NationalRank,
    on3PositionRank: block.on3PositionRank,
    on3StateRank: block.on3StateRank
  };
}

module.exports = {
  buildOn3RankingBlock,
  buildRivalsRankingBlock,
  buildEspnRankingBlock,
  buildAllRankingBlocks,
  selectRankingBlock,
  rankingTokensFromBlock
};
