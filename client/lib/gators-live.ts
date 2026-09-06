/**
 * Gators Live — Florida football game-day scoreboard helpers.
 * Poll provider APIs only inside a UF live window (not year-round).
 */
import { SCHEDULE_GAMES, type ScheduleGame } from './schedule-data';

/** Hours before kickoff to start polling. */
const PREGAME_HOURS = 3;
/** Hours after kickoff to keep polling (covers OT / final). */
const POSTGAME_HOURS = 5;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function easternLocalToDate(
  year: number,
  month: number,
  day: number,
  hour24: number,
  minute: number,
): Date {
  const wanted = Date.UTC(year, month - 1, day, hour24, minute, 0);
  let utc = wanted;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
    );
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    const got = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second || 0),
    );
    const diff = wanted - got;
    utc += diff;
    if (diff === 0) break;
  }
  return new Date(utc);
}

export function parseScheduleKickoff(dateStr: string): Date | null {
  let cleaned = String(dateStr || '')
    .replace(/\s*[·|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (/\b(OFF|FLEX|EARLY|NIGHT|TBA|TBD)\b/i.test(cleaned)) return null;
  cleaned = cleaned
    .replace(
      /(\d{1,2}:\d{2})\s*[-–]\s*\d{1,2}:\d{2}\s*(AM|PM)/i,
      (_, t, ap) => `${t} ${ap}`,
    )
    .trim();
  const m = cleaned.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?(?:\s*ET)?/i,
  );
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (!m[4]) return easternLocalToDate(year, month, day, 12, 0);
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const ap = String(m[6] || 'AM').toUpperCase();
    if (ap === 'PM' && hour < 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return easternLocalToDate(year, month, day, hour, minute);
  }
  const d = new Date(cleaned.replace(/\s*ET\s*$/i, '').trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

export function getUfScheduleGames(): ScheduleGame[] {
  return SCHEDULE_GAMES.slice();
}

/** Next upcoming game, or the current game if we're inside its live window. */
export function getFeaturedUfGame(now = new Date()): ScheduleGame | null {
  const games = getUfScheduleGames();
  if (!games.length) return null;

  let current: ScheduleGame | null = null;
  let next: ScheduleGame | null = null;
  let nextTs = Infinity;

  for (const g of games) {
    if (g.kind === 'bye' || String(g.id || '').startsWith('bye')) continue;
    const kick = parseScheduleKickoff(g.date);
    if (!kick) continue;
    const start = kick.getTime() - PREGAME_HOURS * 3600_000;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    const t = now.getTime();
    if (t >= start && t <= end) {
      current = g;
      break;
    }
    if (kick.getTime() > t && kick.getTime() < nextTs) {
      nextTs = kick.getTime();
      next = g;
    }
  }

  return current || next || games[0] || null;
}

/** True when UF is in pregame → final window — only then should we hit score/odds APIs. */
export function isUfGameLiveWindow(now = new Date()): boolean {
  const games = getUfScheduleGames();
  const t = now.getTime();
  for (const g of games) {
    if (g.kind === 'bye' || String(g.id || '').startsWith('bye')) continue;
    const kick = parseScheduleKickoff(g.date);
    if (!kick) continue;
    const start = kick.getTime() - PREGAME_HOURS * 3600_000;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    if (t >= start && t <= end) return true;
  }
  return false;
}

export function gatorsLiveMode(now = new Date()): 'live-window' | 'ready' {
  return isUfGameLiveWindow(now) ? 'live-window' : 'ready';
}

export type GatorsLivePhase = 'ready' | 'pregame' | 'live' | 'halftime' | 'final';

export function gatorsLivePhase(input: {
  mode: 'ready' | 'live-window';
  live?: boolean;
  completed?: boolean;
  status?: string;
}): GatorsLivePhase {
  if (input.mode === 'ready') return 'ready';
  const status = String(input.status || '');
  if (input.completed === true || /\bfinal\b/i.test(status)) return 'final';
  if (/halftime/i.test(status)) return 'halftime';
  if (input.live === true || /in progress|\blive\b/i.test(status)) return 'live';
  return 'pregame';
}

export function gatorsLiveVoice(phase: GatorsLivePhase, opp: string): string {
  const who = String(opp || 'the opponent').trim() || 'the opponent';
  if (phase === 'live') return `Florida is on the field vs ${who}. Talk every snap.`;
  if (phase === 'halftime') return `Halftime vs ${who}. What is working. What is not.`;
  if (phase === 'final') return `Final vs ${who}. Stay for the after. What did you see?`;
  if (phase === 'pregame') return `The window is open vs ${who}. Talk now, then through kickoff.`;
  return `Next: Florida vs ${who}. The room stays open all week.`;
}

export function possessionSide(possession?: string | null): 'uf' | 'opp' | null {
  const raw = String(possession || '').trim();
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p === '57' || p === 'fla' || p === 'uf') return 'uf';
  if (p.includes('florida') && !p.includes('atlantic') && !p.includes('state')) return 'uf';
  return 'opp';
}

export function periodClockLabel(opts: {
  phase: GatorsLivePhase;
  period?: number | null;
  clock?: string | null;
  status?: string;
}): string {
  if (opts.phase === 'final') return 'Final';
  if (opts.phase === 'halftime') return 'Halftime';
  const clock = String(opts.clock || '').trim();
  const period = opts.period;
  if (period != null && Number.isFinite(period)) {
    const q =
      period === 1 ? '1st' : period === 2 ? '2nd' : period === 3 ? '3rd' : period === 4 ? '4th' : `OT${period - 4 || ''}`;
    return clock ? `${q} · ${clock}` : `${q} quarter`;
  }
  const status = String(opts.status || '').trim();
  if (status) return status;
  if (opts.phase === 'pregame') return 'Scheduled';
  return 'Game window';
}

export const GATORS_LIVE_POLL_MS = 10_000;
export const GATORS_LIVE_IDLE_POLL_MS = 15_000;

export function gatorsLivePollMs(phase: GatorsLivePhase): number {
  if (phase === 'live' || phase === 'halftime') return GATORS_LIVE_POLL_MS;
  return GATORS_LIVE_IDLE_POLL_MS;
}

export function kickCountdown(
  dateStr: string,
  now = new Date(),
): { days: number; hours: number; minutes: number; seconds: number } | null {
  const kick = parseScheduleKickoff(dateStr);
  if (!kick) return null;
  const ms = kick.getTime() - now.getTime();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

export function findLastCompletedUfGame(now = new Date()): ScheduleGame | null {
  const games = getUfScheduleGames();
  let best: ScheduleGame | null = null;
  let bestEnd = -Infinity;
  const t = now.getTime();
  for (const g of games) {
    if (g.kind === 'bye' || String(g.id || '').startsWith('bye')) continue;
    const kick = parseScheduleKickoff(g.date);
    if (!kick) continue;
    const end = kick.getTime() + POSTGAME_HOURS * 3600_000;
    if (end < t && end > bestEnd) {
      bestEnd = end;
      best = g;
    }
  }
  return best;
}

export function pickCommunityTalkThread<T extends {
  dailyKey?: string;
  gameday?: boolean;
  title?: string;
  pinned?: boolean;
  featured?: boolean;
}>(threads: T[]): T | null {
  if (!threads.length) return null;
  const gameday = threads.find((t) => t.gameday || /game day talk/i.test(t.title || ''));
  if (gameday) return gameday;
  const daily = threads.find((t) => Boolean(t.dailyKey));
  if (daily) return daily;
  return threads.find((t) => t.pinned || t.featured) || threads[0] || null;
}

/** Local/dev only. Production hostnames never honor this. */
export function readLocalPreviewPhase(): GatorsLivePhase | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return null;
  const q = new URLSearchParams(window.location.search).get('preview');
  if (q === 'live' || q === 'final' || q === 'pregame' || q === 'ready') return q;
  return null;
}
