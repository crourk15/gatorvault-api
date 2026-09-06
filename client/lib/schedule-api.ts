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

function normalizeUniform(raw: ScheduleGame['uniform'] | null | undefined): ScheduleGame['uniform'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const helmet = String(raw.helmet || '').trim();
  const jersey = String(raw.jersey || '').trim();
  const pants = String(raw.pants || '').trim();
  const label =
    String(raw.label || '').trim() ||
    [helmet, jersey, pants].filter(Boolean).join(' / ');
  if (!helmet && !jersey && !pants && !label) return undefined;
  const out: ScheduleGame['uniform'] = { label };
  if (helmet) out.helmet = helmet;
  if (jersey) out.jersey = jersey;
  if (pants) out.pants = pants;
  if (raw.note != null && String(raw.note).trim()) out.note = String(raw.note).trim();
  if (raw.source != null && String(raw.source).trim()) out.source = String(raw.source).trim();
  return out;
}

/** Prefer live uniform; if API row omitted it (stale disk / flap), keep seed combo. */
function mergeUniform(
  live: ScheduleGame['uniform'] | undefined,
  seed: ScheduleGame['uniform'] | undefined
): ScheduleGame['uniform'] | undefined {
  return normalizeUniform(live) || normalizeUniform(seed);
}

function normalizeGames(raw: ScheduleGame[] | undefined | null): ScheduleGame[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  const seedById = new Map(SCHEDULE_GAMES.map((g) => [g.id, g]));
  return raw
    .map((g) => {
      if (!g || typeof g !== 'object') return null;
      const id = String(g.id || '').trim();
      const opp = String(g.opp || '').trim();
      const date = String(g.date || '').trim();
      if (!id || !opp || !date) return null;
      const seed = seedById.get(id);
      const uniform = mergeUniform(g.uniform, seed?.uniform);
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
        filmNotes: Array.isArray(g.filmNotes)
          ? g.filmNotes.map((n) => String(n || '').trim()).filter(Boolean)
          : seed?.filmNotes,
        offenseScout: Array.isArray(g.offenseScout)
          ? g.offenseScout.map((n) => String(n || '').trim()).filter(Boolean)
          : seed?.offenseScout,
        defenseScout: Array.isArray(g.defenseScout)
          ? g.defenseScout.map((n) => String(n || '').trim()).filter(Boolean)
          : seed?.defenseScout,
        pred: String(g.pred || ''),
        predUF: Number.isFinite(Number(g.predUF)) ? Number(g.predUF) : 0,
        predOpp: Number.isFinite(Number(g.predOpp)) ? Number(g.predOpp) : 0,
        ...(Number.isFinite(Number(g.finalUF)) && Number.isFinite(Number(g.finalOpp))
          ? {
              finalUF: Number(g.finalUF),
              finalOpp: Number(g.finalOpp),
              ...(g.finalSource || seed?.finalSource
                ? { finalSource: String(g.finalSource || seed?.finalSource || '').trim() }
                : {}),
            }
          : Number.isFinite(Number(seed?.finalUF)) && Number.isFinite(Number(seed?.finalOpp))
            ? {
                finalUF: Number(seed?.finalUF),
                finalOpp: Number(seed?.finalOpp),
                ...(seed?.finalSource ? { finalSource: String(seed.finalSource).trim() } : {}),
              }
            : {}),
        ...(String(g.boxScoreUrl || seed?.boxScoreUrl || '').trim()
          ? { boxScoreUrl: String(g.boxScoreUrl || seed?.boxScoreUrl || '').trim() }
          : {}),
        expectedVisitors:
          g.expectedVisitors &&
          typeof g.expectedVisitors === 'object' &&
          Array.isArray((g.expectedVisitors as { visitors?: unknown }).visitors)
            ? (g.expectedVisitors as ScheduleGame['expectedVisitors'])
            : undefined,
        ...(uniform ? { uniform } : {}),
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

/** Test helpers */
export const __scheduleApiTest = { normalizeGames, normalizeUniform, mergeUniform };
