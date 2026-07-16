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
  const cleaned = String(dateStr || '')
    .replace(/\s*[·|]\s*/g, ' ')
    .replace(/\s*ET\s*$/i, '')
    .trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
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
