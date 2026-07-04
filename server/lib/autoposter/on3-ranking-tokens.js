/**
 * Structured On3 ranking extraction for autoposter / Detectives.
 * Only returns tokens when all four fields are present in verified metadata.
 * Never scrape, infer, or guess.
 */

function parseStars(value) {
  const n = parseInt(value, 10);
  return n >= 1 && n <= 5 ? n : null;
}

function parseRank(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

/**
 * @param {object} source — recruiting player, identity snapshot, or explicit On3 fields
 * @returns {{ on3Stars, on3NationalRank, on3PositionRank, on3StateRank } | null}
 */
function extractOn3RankingTokens(source = {}) {
  if (!source || typeof source !== 'object') return null;

  const on3Stars = parseStars(source.on3Stars ?? source.stars);
  const on3NationalRank = parseRank(
    source.on3NationalRank ?? source.natlRank ?? source.nationalRank
  );
  const on3PositionRank = parseRank(
    source.on3PositionRank ?? source.posRank ?? source.positionRank
  );
  const on3StateRank = parseRank(source.on3StateRank ?? source.stateRank);

  if (on3Stars == null || on3NationalRank == null || on3PositionRank == null || on3StateRank == null) {
    return null;
  }

  return { on3Stars, on3NationalRank, on3PositionRank, on3StateRank };
}

/** Compact identity suffix — stars + national / position / state ranks. */
function formatRankingTokensSuffix(rankingTokens, pos = null) {
  if (!rankingTokens) return null;
  const posToken = pos ? String(pos).toUpperCase() : 'POS';
  return (
    `${rankingTokens.on3Stars}★ · On3 #${rankingTokens.on3NationalRank} natl · ` +
    `#${rankingTokens.on3PositionRank} ${posToken} · #${rankingTokens.on3StateRank} state`
  );
}

function appendRankingTokensToIdentity(identityLine, rankingTokens, pos = null) {
  const line = String(identityLine || '').trim();
  if (!line || !rankingTokens) return line;
  if (/On3 #/i.test(line) && /\bnatl\b/i.test(line)) return line;
  const suffix = formatRankingTokensSuffix(rankingTokens, pos);
  return suffix ? `${line} · ${suffix}` : line;
}

async function loadRankingTokensForSlug(slug, fallback = {}) {
  let merged = { ...(fallback || {}) };
  if (slug) {
    try {
      const store = require('../recruiting-store');
      const player = await store.getPlayerBySlug(String(slug).toLowerCase());
      if (player) merged = { ...player, ...merged };
    } catch {
      /* recruiting store optional in some test contexts */
    }
  }
  return extractOn3RankingTokens(merged);
}

module.exports = {
  parseStars,
  parseRank,
  extractOn3RankingTokens,
  formatRankingTokensSuffix,
  appendRankingTokensToIdentity,
  loadRankingTokensForSlug
};
