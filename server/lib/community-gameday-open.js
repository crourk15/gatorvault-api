/**
 * Community Staff open — game-day talk when Florida plays today (ET).
 */
'use strict';

const { parseEasternKickoff } = require('./eastern-kickoff');

function etYmd(date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date instanceof Date ? date : new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

function opponentShort(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Opponent';
  const stripped = s.replace(
    /\s+(Owls|Tigers|Rebels|Gamecocks|Longhorns|Bulldogs|Wildcats|Commodores|Seminoles|Camels|Gators)$/i,
    ''
  );
  return stripped.trim() || s;
}

function isHomeGame(game) {
  const blob = `${game?.label || ''} ${game?.venue || ''} ${game?.site || ''}`;
  if (/\bvs\b/i.test(game?.label || '')) return true;
  if (/\bat\b/i.test(game?.label || '')) return false;
  return /gainesville|swamp|ben hill/i.test(blob);
}

function formatKickClock(kick, dateStr) {
  if (kick && Number.isFinite(kick.getTime())) {
    try {
      const clock = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
      }).format(kick);
      if (!/12:00/.test(clock) || /[AP]M/i.test(String(dateStr || ''))) {
        return `${clock} ET`;
      }
    } catch {
      /* fall through */
    }
  }
  const m = String(dateStr || '').match(/(\d{1,2}:\d{2}\s*[AP]M\s*ET)/i);
  return m ? m[1].replace(/\s+/g, ' ') : null;
}

function loadSeasonGames() {
  try {
    const { getScheduleBoard } = require('./schedule-board');
    const board = getScheduleBoard(2026);
    return Array.isArray(board?.games) ? board.games : [];
  } catch {
    return [];
  }
}

function isByeGame(game) {
  const id = String(game?.id || '');
  const opp = String(game?.opp || game?.opponent || '');
  if (game?.kind === 'bye') return true;
  if (/^bye\b/i.test(id)) return true;
  return /bye week/i.test(opp);
}

function addCalendarDays(ymd, delta) {
  const [y, m, d] = String(ymd || '').split('-').map((n) => Number(n));
  if (!y || !m || !d) return '';
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function findUfGameOnEtDay(dayKey) {
  for (const game of loadSeasonGames()) {
    if (isByeGame(game)) continue;
    const kick = parseEasternKickoff(game.date);
    if (!kick) continue;
    if (etYmd(kick) === dayKey) return { game, kick };
  }
  return null;
}

function buildGameTalkPrompt(game, kick) {
  const opp = opponentShort(game.opp || game.opponent);
  const when = formatKickClock(kick, game.date);
  const tv = String(game.tv || '').trim();
  const place = isHomeGame(game) ? 'The Swamp' : String(game.venue || 'On the road').split(',')[0];
  const whenBit = when || 'Kickoff TBA';
  const tvBit = tv ? ` on ${tv}` : '';
  const dayKey = etYmd(kick);

  return {
    gameId: String(game.id || '').trim() || null,
    title: `Game day talk: Florida vs ${opp}`,
    body:
      `${place}. ${whenBit}${tvBit}. Talk it now, during the game, and after the final whistle. Keys, calls, visitors, what you saw. Stay on Florida.`,
    categorySlug: 'locker',
    gameday: true,
    opponent: opp,
    dayKey,
    kickoffAt: kick.toISOString(),
  };
}

function looksLikeGamedayTalk(thread) {
  if (!thread) return false;
  if (thread.gameday === true) return true;
  return /game day talk/i.test(String(thread.title || ''));
}

/**
 * @param {{ asOf?: Date|string, dayKey?: string }} [opts]
 * @returns {null|{ title: string, body: string, categorySlug: string, gameday: true, opponent: string, dayKey: string }}
 */
function pickGamedayOpen(opts = {}) {
  const asOf = opts.asOf ? new Date(opts.asOf) : new Date();
  const dayKey = opts.dayKey || etYmd(asOf);
  const hit = findUfGameOnEtDay(dayKey);
  if (!hit) return null;
  return buildGameTalkPrompt(hit.game, hit.kick);
}

/**
 * One Game talk room per opponent. Opens six days before kickoff (the week of
 * that team) and stays after Saturday. Later weeks stay closed.
 * @param {{ asOf?: Date|string, dayKey?: string }} [opts]
 */
function listWeeklyGameTalks(opts = {}) {
  const asOf = opts.asOf ? new Date(opts.asOf) : new Date();
  const today = opts.dayKey || etYmd(asOf);
  const rooms = [];
  for (const game of loadSeasonGames()) {
    if (isByeGame(game)) continue;
    const kick = parseEasternKickoff(game.date);
    if (!kick) continue;
    const dayKey = etYmd(kick);
    if (today < addCalendarDays(dayKey, -6)) continue;
    rooms.push(buildGameTalkPrompt(game, kick));
  }
  rooms.sort((a, b) => String(b.dayKey).localeCompare(String(a.dayKey)));
  return rooms;
}

function shouldUpgradeDailyToGameday(existing, gameday) {
  if (!existing || !gameday) return false;
  if (looksLikeGamedayTalk(existing) && existing.title === gameday.title && existing.body === gameday.body) {
    return false;
  }
  if (looksLikeGamedayTalk(existing) && existing.title === gameday.title) return Boolean(existing.body !== gameday.body);
  return true;
}

module.exports = {
  etYmd,
  opponentShort,
  pickGamedayOpen,
  listWeeklyGameTalks,
  looksLikeGamedayTalk,
  shouldUpgradeDailyToGameday,
};
