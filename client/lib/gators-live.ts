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
