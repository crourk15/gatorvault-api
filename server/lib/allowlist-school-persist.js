/**
 * Persist allowlist school/rank patches into recruiting JSON files.
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const { isPlaceholderSchool, isPlaceholderSkinny } = require('./recruiting-placeholder-school');
const { EDITORIAL_2028_YOUNGER_PROSPECTS } = require('./recruiting-editorial-positions');

const BOARD_PATH = path.join(store.DATA_DIR, '2028-target-board.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function mergePatch(existing, patch) {
  const out = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  if (isPlaceholderSchool(out.school)) delete out.school;
  return out;
}

function formatAllowlistEvalSummary(player) {
  const stars = Number(player?.stars) || 0;
  const pos = String(player?.pos || player?.position || 'ATH').trim().toUpperCase();
  const school = player?.school;
  const natlRank = player?.natlRank ?? player?.natl_rank;
  const state = String(player?.state || '').trim().toUpperCase();
  const stateRank = player?.stateRank ?? player?.state_rank;
  const rankPart = Number.isFinite(Number(natlRank))
    ? `#${natlRank} natl`
    : state && Number.isFinite(Number(stateRank))
      ? `On3 ${state} state No. ${stateRank}`
      : Number(player?.rating) > 0
        ? `${Number(player.rating).toFixed(1)} composite`
        : null;
  if (!stars && !rankPart) return null;
  const starPart = stars ? `${stars}★ ${pos}` : pos;
  if (school && !isPlaceholderSchool(school)) {
    return `${starPart} · ${rankPart || 'On3 profile'} · ${school}`;
  }
  if (rankPart) return `${starPart} · ${rankPart}`;
  return null;
}

function applyAllowlistIntelSkinny(player) {
  if (!player) return player;
  if (!isPlaceholderSkinny(player.skinny)) return player;
  const summary = formatAllowlistEvalSummary(player);
  if (!summary) return player;
  return { ...player, skinny: summary, evaluationSummary: summary };
}

function persistAllowlistPlayerToJson(slug, patch) {
  if (!slug || !patch?.school || isPlaceholderSchool(patch.school)) {
    return { slug, ok: false, reason: 'missing_school' };
  }

  const players = readJson(store.PLAYERS_PATH, []);
  const idx = players.findIndex((p) => String(p.slug).toLowerCase() === String(slug).toLowerCase());
  if (idx >= 0) {
    players[idx] = mergePatch(players[idx], patch);
    const summary = formatAllowlistEvalSummary(players[idx]);
    if (summary) {
      players[idx].evaluationSummary = summary;
      if (isPlaceholderSkinny(players[idx].skinny)) players[idx].skinny = summary;
    }
  } else {
    const merged = mergePatch(
      {
        slug,
        name: patch.name || slug,
        classYear: patch.classYear || 2028,
        category: 'target',
        status: 'uncommitted',
      },
      patch
    );
    const summary = formatAllowlistEvalSummary(merged);
    if (summary) {
      merged.evaluationSummary = summary;
      if (isPlaceholderSkinny(merged.skinny)) merged.skinny = summary;
    }
    players.push(merged);
  }
  writeJson(store.PLAYERS_PATH, players);

  const board = readJson(BOARD_PATH, { version: 1, targets: [] });
  board.targets = Array.isArray(board.targets) ? board.targets : [];
  const boardIdx = board.targets.findIndex((t) => String(t.slug).toLowerCase() === String(slug).toLowerCase());
  const boardPatch = {
    school: patch.school,
    state: patch.state ?? null,
    inState: patch.inState ?? patch.state === 'FL',
  };
  if (patch.rating != null) boardPatch.rating = patch.rating;
  if (patch.natlRank != null) boardPatch.natlRank = patch.natlRank;
  if (patch.posRank != null) boardPatch.posRank = patch.posRank;
  if (patch.stateRank != null) boardPatch.stateRank = patch.stateRank;
  if (patch.stars != null) boardPatch.stars = patch.stars;

  if (boardIdx >= 0) {
    board.targets[boardIdx] = { ...board.targets[boardIdx], ...boardPatch };
  } else if (EDITORIAL_2028_YOUNGER_PROSPECTS.has(String(slug).toLowerCase())) {
    board.targets.push({ slug, name: patch.name || slug, pos: patch.pos || null, classYear: 2028, ...boardPatch });
  }
  writeJson(BOARD_PATH, board);

  try {
    const { clearRecruitingRankingsCache } = require('./load-recruiting-rankings.ts');
    clearRecruitingRankingsCache();
  } catch {
    /* optional */
  }

  return { slug, ok: true, school: patch.school, state: patch.state ?? null };
}

module.exports = {
  BOARD_PATH,
  persistAllowlistPlayerToJson,
  formatAllowlistEvalSummary,
  applyAllowlistIntelSkinny,
};