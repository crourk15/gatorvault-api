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

function findUfGameOnEtDay(dayKey) {
  let games = [];
  try {
    const { getScheduleBoard } = require('./schedule-board');
    const board = getScheduleBoard(2026);
    games = Array.isArray(board?.games) ? board.games : [];
  } catch {
    games = [];
  }
  for (const game of games) {
    const kick = parseEasternKickoff(game.date);
    if (!kick) continue;
    if (etYmd(kick) === dayKey) return { game, kick };
  }
  return null;
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

  const opp = opponentShort(hit.game.opp || hit.game.opponent);
  const when = formatKickClock(hit.kick, hit.game.date);
  const tv = String(hit.game.tv || '').trim();
  const place = isHomeGame(hit.game) ? 'The Swamp' : String(hit.game.venue || 'On the road').split(',')[0];
  const whenBit = when || 'Kickoff TBA';
  const tvBit = tv ? ` on ${tv}` : '';

  return {
    title: `Game day talk: Florida vs ${opp}`,
    body:
      `${place}. ${whenBit}${tvBit}. Talk it now, during the game, and after the final whistle. Keys, calls, visitors, what you saw. Stay on Florida.`,
    categorySlug: 'locker',
    gameday: true,
    opponent: opp,
    dayKey,
  };
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
  looksLikeGamedayTalk,
  shouldUpgradeDailyToGameday,
};
