/**
 * Gators Live — Florida football game-day scoreboard helpers.
 * Poll provider APIs only inside a UF live window (not year-round).
 */
import { SCHEDULE_GAMES, type ScheduleGame } from './schedule-data';

/** Hours before kickoff to start polling. */
const PREGAME_HOURS = 3;
/** Hours after kickoff to keep polling (covers OT / final). */
const POSTGAME_HOURS = 5;

export function parseScheduleKickoff(dateStr: string): Date | null {
  let cleaned = String(dateStr || '')
    .replace(/\s*[·|]\s*/g, ' ')
    .replace(/\s*ET\s*$/i, '')
    .trim();
  if (!cleaned) return null;
  // Open date / placeholders — use calendar date at noon local so ordering still works.
  cleaned = cleaned.replace(/\b(OFF|FLEX|EARLY|NIGHT|TBA|TBD)\b/gi, '').trim();
  // Kickoff windows ("3:30–8:00 PM") → use window start.
  cleaned = cleaned
    .replace(
      /(\d{1,2}:\d{2})\s*[-–]\s*\d{1,2}:\d{2}\s*(AM|PM)/i,
      (_, t, ap) => `${t} ${ap}`,
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  let d = new Date(cleaned);
  if (Number.isFinite(d.getTime())) return d;
  // Date-only fallback (month day, year).
  const m = cleaned.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i,
  );
  if (!m) return null;
  d = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00:00`);
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
