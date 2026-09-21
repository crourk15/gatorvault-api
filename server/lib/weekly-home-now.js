/**
 * Home NOW weekly slate — three solid lines that move with the game week.
 * Slot 1 is the live game chip. Slots 2–3 are place + record. No class-rank filler.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildHomeNowGameStory,
  pickCurrentNowGame,
  parseScheduleKickoffMs,
} = require('./elite-home-now');

const OVERRIDE_PATH = path.join(__dirname, '..', 'data', 'home', 'weekly-now.json');
const SEC_OPP =
  /\b(ole miss|georgia|lsu|alabama|auburn|texas a&m|oklahoma|tennessee|kentucky|missouri|south carolina|vanderbilt|arkansas|mississippi state)\b/i;

function loadWeeklyOverride() {
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDE_PATH, 'utf8'));
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

function isHomeGame(game) {
  const venue = String(game?.venue || '');
  const label = String(game?.label || '');
  if (/@/.test(label) || /\bat\b/i.test(label)) return false;
  if (/gainesville|swamp|hill griffin/i.test(venue)) return true;
  return /\bvs\b/i.test(label);
}

function isSecOpponent(game) {
  const blob = `${game?.opp || ''} ${game?.label || ''}`;
  return SEC_OPP.test(blob);
}

function seasonRecord(now = new Date(), games) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  let wins = 0;
  let losses = 0;
  for (const g of Array.isArray(games) ? games : []) {
    if (!g || g.kind === 'bye') continue;
    const uf = Number(g.finalUF);
    const opp = Number(g.finalOpp);
    if (!Number.isFinite(uf) || !Number.isFinite(opp)) continue;
    const kickMs = parseScheduleKickoffMs(g.date);
    if (Number.isFinite(kickMs) && kickMs > nowMs) continue;
    if (uf > opp) wins += 1;
    else if (uf < opp) losses += 1;
  }
  return { wins, losses };
}

function firstSecHome(now = new Date(), current, games) {
  if (!current || !isHomeGame(current.game) || !isSecOpponent(current.game)) return false;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  for (const g of Array.isArray(games) ? games : []) {
    if (!g || g.kind === 'bye') continue;
    if (String(g.id) === String(current.game.id)) continue;
    if (!isHomeGame(g) || !isSecOpponent(g)) continue;
    const uf = Number(g.finalUF);
    const opp = Number(g.finalOpp);
    if (!Number.isFinite(uf) || !Number.isFinite(opp)) continue;
    const kickMs = parseScheduleKickoffMs(g.date);
    if (Number.isFinite(kickMs) && kickMs < nowMs) return false;
  }
  return true;
}

function weekdayForKick(kickMs) {
  return new Date(kickMs).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York',
  });
}

function autoPlaceLine(picked) {
  if (!picked?.game) return null;
  const weekday = weekdayForKick(picked.kickMs);
  if (!isHomeGame(picked.game)) {
    return `On the road this ${weekday}`;
  }
  try {
    const { visitorsPanelForGameId } = require('./game-week-visitors');
    const panel = visitorsPanelForGameId(picked.game.id);
    if (panel && Array.isArray(panel.visitors) && panel.visitors.length) {
      return `Expected visitors in the Swamp this ${weekday}`;
    }
  } catch {
    /* optional */
  }
  return `Home in the Swamp this ${weekday}`;
}

function autoStandingLine(now, picked, games) {
  if (!picked) return null;
  const { wins, losses } = seasonRecord(now, games);
  const weekday = weekdayForKick(picked.kickMs);
  if (firstSecHome(now, picked, games)) {
    return `${wins}-${losses} — first SEC home ${weekday}`;
  }
  if (isSecOpponent(picked.game) && isHomeGame(picked.game)) {
    return `${wins}-${losses} — SEC home ${weekday}`;
  }
  return `${wins}-${losses} heading into ${weekday}`;
}

function gamesForNow() {
  try {
    const { getScheduleBoard } = require('./schedule-board');
    const board = getScheduleBoard(2026);
    return Array.isArray(board?.games) ? board.games : [];
  } catch {
    return [];
  }
}

/**
 * Three weekly NOW lines, or [] when there is no game in the 14-day window.
 */
function buildWeeklyHomeNowLines(now = new Date(), games) {
  const list = Array.isArray(games) ? games : gamesForNow();
  const gameStory = buildHomeNowGameStory(now, list);
  if (!gameStory) return [];
  const picked = pickCurrentNowGame(now, list);
  const override = loadWeeklyOverride();
  const week = picked?.game?.id
    ? override?.weeks?.[String(picked.game.id)] || null
    : null;
  const place = String(week?.place || '').trim() || autoPlaceLine(picked);
  const standing = String(week?.standing || '').trim() || autoStandingLine(now, picked, list);
  const lines = [gameStory];
  if (place && place !== gameStory) lines.push(place);
  if (standing && !lines.includes(standing)) lines.push(standing);
  return lines.slice(0, 3);
}

module.exports = {
  OVERRIDE_PATH,
  buildWeeklyHomeNowLines,
  seasonRecord,
  autoPlaceLine,
  autoStandingLine,
};
