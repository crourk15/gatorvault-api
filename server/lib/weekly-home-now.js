/**
 * Home NOW weekly slate — three pillars that move with the game week.
 * Game / Visitors (or Road) / Season. ABC lives on Game only.
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

function visitorNamesForGame(gameId) {
  try {
    const { visitorsPanelForGameId } = require('./game-week-visitors');
    const panel = visitorsPanelForGameId(gameId);
    return (panel?.visitors || [])
      .map((v) => String(v.name || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function shortVisitorName(name) {
  const cleaned = String(name || '')
    .trim()
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(1).join(' ');
  return parts[0] || String(name || '').trim();
}

function compactVisitorLine(names) {
  const full = (Array.isArray(names) ? names : []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!full.length) return null;
  return `Visitors — ${full[0]}`;
}

function autoPlaceLine(picked) {
  if (!picked?.game) return null;
  const weekday = weekdayForKick(picked.kickMs);
  if (!isHomeGame(picked.game)) {
    return `Road — on the road this ${weekday}`;
  }
  const names = visitorNamesForGame(picked.game.id);
  if (names.length) return `Visitors — ${names[0]}`;
  return `Visitors — home this ${weekday}`;
}

function autoStandingLine(now, picked, games) {
  if (!picked) return null;
  const { wins, losses } = seasonRecord(now, games);
  const weekday = weekdayForKick(picked.kickMs);
  if (firstSecHome(now, picked, games)) {
    return `Season — ${wins}-${losses} · first SEC home ${weekday}`;
  }
  if (isSecOpponent(picked.game) && isHomeGame(picked.game)) {
    return `Season — ${wins}-${losses} · SEC home ${weekday}`;
  }
  return `Season — ${wins}-${losses} heading into ${weekday}`;
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

function stripPillarPrefix(text) {
  return String(text || '')
    .replace(/^(Game|Visitors|Road|Season|News|Live|Game Week|Up next)\s+[—-]\s+/i, '')
    .trim();
}

/** Extra Season items from weekly-now.json `seasonTicks`. Empty the array to drop. */
function seasonTickLines(override, opts = {}) {
  const raw = opts.seasonTicks !== undefined ? opts.seasonTicks : override?.seasonTicks;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    const stripped = stripPillarPrefix(t);
    if (stripped && !out.includes(stripped)) out.push(stripped);
  }
  return out;
}

function seasonItemsForWeek(standing, override, opts = {}) {
  const items = [];
  // Extra ticks first so iOS 1.0.29 (items[0] on open) shows the update
  // before the 7s rotate — website already had time to land on the second line.
  for (const tick of seasonTickLines(override, opts)) {
    if (!items.includes(tick)) items.push(tick);
  }
  const standingItem = stripPillarPrefix(standing);
  if (standingItem && !items.includes(standingItem)) items.push(standingItem);
  return items;
}

function formatGamePillar(gameStory) {
  const t = String(gameStory || '').trim();
  if (!t) return null;
  if (/^LIVE —/i.test(t)) return t;
  if (/^Game — /i.test(t)) return t;
  if (/^Game Week — /i.test(t)) return t.replace(/^Game Week — /i, 'Game — ');
  if (/^Up next — /i.test(t)) return t.replace(/^Up next — /i, 'Game — ');
  return `Game — ${t}`;
}

/**
 * Structured weekly pillars for Home NOW.
 * Game owns the network. Visitors ticks names. Season is the record
 * plus optional weekly-now.json seasonTicks (drop by emptying the array).
 */
function buildWeeklyHomeNowCategories(now = new Date(), games, opts = {}) {
  const list = Array.isArray(games) ? games : gamesForNow();
  const gameStory = buildHomeNowGameStory(now, list);
  if (!gameStory) return [];
  const picked = pickCurrentNowGame(now, list);
  const override = loadWeeklyOverride();
  const week = picked?.game?.id ? override?.weeks?.[String(picked.game.id)] || null : null;
  const gameLine = formatGamePillar(gameStory);
  const standing = String(week?.standing || '').trim() || autoStandingLine(now, picked, list);
  const home = isHomeGame(picked?.game);
  const names = home && picked?.game?.id ? visitorNamesForGame(picked.game.id) : [];
  const hasVisitors = Boolean(home && names.length);
  const { pickWeeklyNowBreakIn } = require('./weekly-now-breakin');
  const breakIn = pickWeeklyNowBreakIn(now, {
    biggerThanVisitors: hasVisitors,
    rows: opts.breakInRows,
  });

  const categories = [];
  if (gameLine) {
    categories.push({
      key: /^LIVE —/i.test(gameLine) ? 'live' : 'game',
      label: /^LIVE —/i.test(gameLine) ? 'Live' : 'Game',
      items: [stripPillarPrefix(gameLine)],
    });
  }
  if (breakIn && breakIn.text) {
    categories.push({
      key: 'news',
      label: 'News',
      items: [breakIn.text],
    });
  } else {
    const place = String(week?.place || '').trim() || autoPlaceLine(picked);
    if (place || names.length) {
      const isRoad = /^Road —|^On the road/i.test(place || '');
      categories.push({
        key: isRoad ? 'road' : 'visitors',
        label: isRoad ? 'Road' : 'Visitors',
        items: names.length ? names : [stripPillarPrefix(place)],
      });
    }
  }
  const seasonItems = seasonItemsForWeek(standing, override, opts);
  if (seasonItems.length) {
    categories.push({
      key: 'season',
      label: 'Season',
      items: seasonItems,
    });
  }
  return categories.slice(0, 3);
}

/**
 * Three weekly NOW lines for ticker / 1.0.28.
 * Game first so ABC never sits under a visitors heading.
 */
function buildWeeklyHomeNowLines(now = new Date(), games, opts = {}) {
  const cats = buildWeeklyHomeNowCategories(now, games, opts);
  const lines = [];
  for (const c of cats) {
    if ((c.key === 'visitors' || c.key === 'season') && c.items.length) {
      for (const name of c.items) {
        if (name) lines.push(`${c.label} — ${name}`);
      }
      continue;
    }
    const item = c.items[0] || '';
    if (!item) continue;
    lines.push(`${c.label} — ${item}`);
  }
  return lines;
}

/** Home NOW pillars — attach even when hub ticker items are still warming. */
function attachLiveNowWeek(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  if (Array.isArray(body.nowWeek) && body.nowWeek.length) return body;
  const nowWeek = buildWeeklyHomeNowCategories();
  if (nowWeek.length) body.nowWeek = nowWeek;
  return body;
}

/**
 * Cheap ticker pack for iOS 1.0.29 — never waits on hub cache / status:building.
 * apiFetch throws building away and Home keeps last-good Season.
 */
function buildHomeNowTickerPack(now = new Date(), games, opts = {}) {
  const nowWeek = buildWeeklyHomeNowCategories(now, games, opts);
  const items = buildWeeklyHomeNowLines(now, games, opts);
  return {
    ok: true,
    status: 'ready',
    items,
    nowWeek,
    meta: {
      endpoint: 'ticker',
      cacheReason: 'now-direct',
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  OVERRIDE_PATH,
  buildWeeklyHomeNowLines,
  buildWeeklyHomeNowCategories,
  attachLiveNowWeek,
  buildHomeNowTickerPack,
  seasonRecord,
  autoPlaceLine,
  autoStandingLine,
  seasonTickLines,
  shortVisitorName,
  pickWeeklyNowBreakIn: require('./weekly-now-breakin').pickWeeklyNowBreakIn,
};
