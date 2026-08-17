/**
 * Live schedule fetch — API is source of truth after client bake.
 * Seed fallback: SCHEDULE_GAMES (bundled) so cold/offline still renders.
 */
import { snapshotLiveFetch } from './snapshot-fetch';
import { SCHEDULE_GAMES, type ScheduleGame } from './schedule-data';

export type ScheduleBoardResponse = {
  ok?: boolean;
  season?: number;
  updatedAt?: string;
  label?: string;
  source?: string;
  games?: ScheduleGame[];
  count?: number;
};

function normalizeGames(raw: ScheduleGame[] | undefined | null): ScheduleGame[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw
    .map((g) => {
      if (!g || typeof g !== 'object') return null;
      const id = String(g.id || '').trim();
      const opp = String(g.opp || '').trim();
      const date = String(g.date || '').trim();
      if (!id || !opp || !date) return null;
      return {
        ...g,
        id,
        opp,
        date,
        label: String(g.label || id).trim(),
        venue: String(g.venue || '').trim(),
        ufPct: Number.isFinite(Number(g.ufPct)) ? Number(g.ufPct) : 50,
        keys: Array.isArray(g.keys) ? g.keys : [],
        swing: Array.isArray(g.swing) ? g.swing : [],
        film: String(g.film || ''),
        pred: String(g.pred || ''),
        predUF: Number.isFinite(Number(g.predUF)) ? Number(g.predUF) : 0,
        predOpp: Number.isFinite(Number(g.predOpp)) ? Number(g.predOpp) : 0,
        expectedVisitors:
          g.expectedVisitors &&
          typeof g.expectedVisitors === 'object' &&
          Array.isArray((g.expectedVisitors as { visitors?: unknown }).visitors)
            ? (g.expectedVisitors as ScheduleGame['expectedVisitors'])
            : undefined,
      } as ScheduleGame;
    })
    .filter(Boolean) as ScheduleGame[];
}

export function fallbackScheduleGames(): ScheduleGame[] {
  return SCHEDULE_GAMES.slice();
}

export async function fetchScheduleGames(season = 2026): Promise<ScheduleGame[]> {
  try {
    // Always await live schedule — do not return a stale SWR cache hit. Game Week
    // keys (Expected visitors, film notes) update via API without Codemagic; a
    // cache-first paint left the UI on yesterday's slate until hard refresh.
    const data = await snapshotLiveFetch<ScheduleBoardResponse>(
      `/api/schedule?year=${season}`
    );
    const live = normalizeGames(data?.games);
    if (live.length) return live;
  } catch {
    /* fall through */
  }
  return fallbackScheduleGames();
}
