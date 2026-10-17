/**
 * Gators Live was skipping Texas because that kickoff was still TBA, so the
 * score API sat on Georgia and the page flipped between Game day and Next up.
 * While noon Oct 17 is the window, serve the ESPN Florida board from the edge
 * the installed app already calls. A correct upstream board passes through.
 */
const TEXAS_KICKOFF_MS = Date.parse('2026-10-17T16:00:00.000Z');
const PREGAME_MS = 3 * 60 * 60 * 1000;
const POSTGAME_MS = 8 * 60 * 60 * 1000;
const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20261017&groups=80&limit=300';

function inTexasWindow(now = Date.now()) {
  return now >= TEXAS_KICKOFF_MS - PREGAME_MS && now <= TEXAS_KICKOFF_MS + POSTGAME_MS;
}

function isFlorida(team) {
  if (!team || typeof team !== 'object') return false;
  if (String(team.id) === '57') return true;
  const abbr = String(team.abbreviation || '').toUpperCase();
  if (abbr === 'FLA' || abbr === 'UF') return true;
  if (abbr === 'FSU' || abbr === 'FAU' || abbr === 'FIU') return false;
  const name = String(team.displayName || team.name || '');
  if (/state|atlantic|international/i.test(name)) return false;
  return /^florida(?:\s+gators)?$/i.test(name.trim());
}

function ordinal(period) {
  const n = Number(period);
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  if (n === 4) return '4th';
  if (n > 4) return `OT${n - 4 === 1 ? '' : n - 4}`;
  return '';
}

function statusLine(game) {
  if (!game) return 'Scheduled';
  if (game.completed) return game.detail && /final/i.test(game.detail) ? game.detail : 'Final';
  if (/halftime/i.test(`${game.detail || ''} ${game.state || ''}`)) return 'Halftime';
  const q = ordinal(game.period);
  if (game.live && q && game.clock) return `${q} quarter · ${game.clock}`;
  if (game.live && game.detail) return game.detail;
  if (game.live) return 'In progress';
  return game.detail || 'Sat, October 17th at 12:00 PM ET';
}

function floridaGame(scoreboard) {
  const events = scoreboard?.events || [];
  for (const event of events) {
    for (const comp of event.competitions || []) {
      const competitors = comp.competitors || [];
      const florida = competitors.find((c) => isFlorida(c.team));
      if (!florida) continue;
      const opponent = competitors.find((c) => c !== florida);
      const type = comp.status?.type || {};
      const state = String(type.name || type.state || '').toLowerCase();
      const completed = Boolean(type.completed) || /final/i.test(state);
      const live = !completed && /in|live|halftime|end.?period|end.?half/i.test(state);
      const ufScore = florida.score != null && florida.score !== '' ? Number(florida.score) : 0;
      const oppScore = opponent?.score != null && opponent.score !== '' ? Number(opponent.score) : 0;
      const detail = String(type.detail || type.shortDetail || '').trim();
      const game = {
        eventId: String(event.id || comp.id || '401856724'),
        opponent: opponent?.team?.displayName || 'Texas Longhorns',
        opponentShort: opponent?.team?.abbreviation || 'TEX',
        ufScore: Number.isFinite(ufScore) ? ufScore : 0,
        oppScore: Number.isFinite(oppScore) ? oppScore : 0,
        state,
        completed,
        live,
        clock: String(comp.status?.displayClock || '').trim() || null,
        period: Number(comp.status?.period) || null,
        detail,
        possession: comp.situation?.possession || null,
      };
      const status = statusLine(game);
      return {
        ...game,
        status,
        matchup: `Florida vs ${game.opponent}`,
      };
    }
  }
  return null;
}

function payloadFromBoard(board) {
  return {
    ok: true,
    mode: 'live-window',
    inWindow: true,
    featured: {
      id: 'texas',
      opp: 'Texas Longhorns',
      date: 'October 17, 2026 12:00 PM ET',
      kickoffIso: '2026-10-17T16:00:00.000Z',
    },
    board,
    overlay: board
      ? {
          homeScore: board.ufScore,
          awayScore: board.oppScore,
          status: board.status,
          clock: board.clock,
          period: board.period,
          live: board.live,
          completed: board.completed,
          scoreSource: 'espn',
        }
      : null,
    source: 'espn',
    fetchedAt: new Date().toISOString(),
  };
}

function upstreamIsTexas(data) {
  if (!data || data.mode !== 'live-window' || data.inWindow !== true || !data.board) return false;
  const blob = `${data.featured?.id || ''} ${data.featured?.opp || ''} ${data.board.opponent || ''}`.toLowerCase();
  return blob.includes('texas');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
      pragma: 'no-cache',
    },
  });
}

export default async (request, context) => {
  if (!inTexasWindow()) return context.next();

  let upstreamData = null;
  try {
    const upstream = await context.next();
    upstreamData = await upstream.json();
    if (upstreamIsTexas(upstreamData)) return jsonResponse(upstreamData, upstream.status || 200);
  } catch {
    upstreamData = null;
  }

  try {
    const res = await fetch(ESPN_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'GatorVaultGatorsLive/1.0' },
    });
    if (res.ok) {
      const board = floridaGame(await res.json());
      if (board && /texas/i.test(board.opponent)) return jsonResponse(payloadFromBoard(board));
    }
  } catch {
    /* keep the origin body */
  }

  if (upstreamData) return jsonResponse(upstreamData);
  return context.next();
};
