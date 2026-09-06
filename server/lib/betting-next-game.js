/**
 * Pure next-game picker — no network deps.
 * Codemagic client builds must not load betting-lines.js (node-fetch).
 */
'use strict';

/** Hold the just-played game through the Gators Live postgame window, then advance. */
const POSTGAME_HOURS = 5;

function gameKickMs(g) {
  const d = new Date(g && (g.date || g.kickoff) || '');
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

/** Current live/postgame game, else the next kickoff. Never stay on a finished opener. */
function pickNextGame(games, now) {
  const t = (now || new Date()).getTime();
  const holdMs = POSTGAME_HOURS * 3600 * 1000;
  const sorted = (games || [])
    .filter((g) => g && Number.isFinite(gameKickMs(g)))
    .sort((a, b) => gameKickMs(a) - gameKickMs(b));
  const current = sorted.find((g) => {
    const kick = gameKickMs(g);
    return t >= kick && t <= kick + holdMs;
  });
  if (current) return current;
  const upcoming = sorted.find((g) => gameKickMs(g) > t);
  return upcoming || sorted[sorted.length - 1] || null;
}

function pickLastCompleted(games, now) {
  const t = (now || new Date()).getTime();
  const holdMs = POSTGAME_HOURS * 3600 * 1000;
  const past = (games || [])
    .filter((g) => g && Number.isFinite(gameKickMs(g)) && gameKickMs(g) + holdMs < t)
    .sort((a, b) => gameKickMs(b) - gameKickMs(a));
  return past[0] || null;
}

module.exports = {
  POSTGAME_HOURS,
  gameKickMs,
  pickNextGame,
  pickLastCompleted,
};
