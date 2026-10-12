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

function isNeutralSite(game) {
  const blob = `${game?.label || ''} ${game?.venue || ''} ${game?.site || ''}`;
  return /atlanta|mercedes-benz|neutral/i.test(blob);
}

function isHomeGame(game) {
  if (isNeutralSite(game)) return false;
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
  const place = isNeutralSite(game)
    ? String(game.venue || 'Neutral site').split(',')[0]
    : isHomeGame(game)
      ? 'The Swamp'
      : String(game.venue || 'On the road').split(',')[0];
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

function sortGameTalkPrompts(rooms, today) {
  const day = String(today || '');
  return rooms.sort((a, b) => {
    const ad = String(a.dayKey || '');
    const bd = String(b.dayKey || '');
    const aUp = ad >= day;
    const bUp = bd >= day;
    if (aUp !== bUp) return aUp ? -1 : 1;
    if (aUp) return ad.localeCompare(bd);
    return bd.localeCompare(ad);
  });
}

/**
 * One Game talk room per opponent. The current week opens six days before
 * kickoff. The following game opens with that week, so it is not created on
 * its own Saturday. A later week stays closed (Texas stays closed on Oct 10).
 * @param {{ asOf?: Date|string, dayKey?: string }} [opts]
 */
function listWeeklyGameTalks(opts = {}) {
  const asOf = opts.asOf ? new Date(opts.asOf) : new Date();
  const today = opts.dayKey || etYmd(asOf);
  const dated = [];
  for (const game of loadSeasonGames()) {
    if (isByeGame(game)) continue;
    const kick = parseEasternKickoff(game.date);
    if (!kick) continue;
    dated.push({ game, kick, dayKey: etYmd(kick) });
  }
  dated.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const rooms = [];
  let latestOpen = null;
  for (const row of dated) {
    if (today < addCalendarDays(row.dayKey, -6)) continue;
    rooms.push(buildGameTalkPrompt(row.game, row.kick));
    latestOpen = row;
  }
  // Current week's kick is still ahead — open the game after it now.
  if (latestOpen && latestOpen.dayKey > today) {
    const next = dated.find((row) => row.dayKey > latestOpen.dayKey);
    if (next && !rooms.some((room) => room.gameId === String(next.game.id || ''))) {
      rooms.push(buildGameTalkPrompt(next.game, next.kick));
    }
  }
  return sortGameTalkPrompts(rooms, today);
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
