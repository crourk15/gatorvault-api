/**
 * Live schedule fetch — API is source of truth after client bake.
 * Seed fallback: SCHEDULE_GAMES (bundled) so cold/offline still renders.
 * Do not refill desk scout (offenseScout / defenseScout / scoutingReport) from seed.
 */
import { snapshotLiveFetch } from './snapshot-fetch';
import { SCHEDULE_GAMES, SCHEDULE_SEED_PRED_THROUGH, type ScheduleGame } from './schedule-data';

export type ScheduleBoardResponse = {
  ok?: boolean;
  season?: number;
  updatedAt?: string;
  label?: string;
  source?: string;
  /** Remaining-season predictions last restamped through this week (e.g. 2026-W2). */
  predThrough?: string;
  currentGameId?: string;
  games?: ScheduleGame[];
  count?: number;
};

export type ScheduleBoardLive = {
  games: ScheduleGame[];
  currentGameId?: string;
  /** Remaining-season pred week from live `/api/schedule` (e.g. 2026-W5). */
  predThrough?: string;
};

function hasPostedFinal(game: ScheduleGame): boolean {
  return Number.isFinite(Number(game.finalUF)) && Number.isFinite(Number(game.finalOpp));
}

/** Remaining-game leans are live-only. Do not first-paint last-good or seed scores. */
export function stripRemainingPreds(games: ScheduleGame[]): ScheduleGame[] {
  return games.map((game) => {
    if (hasPostedFinal(game)) return game;
    return {
      ...game,
      pred: '',
      predUF: 0,
      predOpp: 0,
      ufPct: 0,
      predPending: true,
      predConfidence: undefined,
      predMovement: undefined,
      ufPctDelta: undefined,
    };
  });
}

function seedBoard(): ScheduleBoardLive {
  return {
    games: SCHEDULE_GAMES.slice(),
    predThrough: SCHEDULE_SEED_PRED_THROUGH,
  };
}

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

function isKickoffWindow(date: string): boolean {
  return /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(date);
}

function isFirmKickoff(date: string): boolean {
  return /\d{1,2}:\d{2}\s*(AM|PM)/i.test(date) && !isKickoffWindow(date);
}

/** Prefer a firm kickoff over a leftover SEC window (3:30–8:00). */
function preferKickoffDate(live: string, seed?: string): string {
  const seedDate = String(seed || '').trim();
  if (isKickoffWindow(live) && isFirmKickoff(seedDate)) return seedDate;
  return live || seedDate;
}

function preferTv(live: unknown, seed?: string): string | undefined {
  const liveTv = String(live || '').trim();
  const seedTv = String(seed || '').trim();
  if ((!liveTv || /^(TBD|TBA|—|-)$/i.test(liveTv)) && seedTv && !/^(TBD|TBA|—|-)$/i.test(seedTv)) {
    return seedTv;
  }
  return liveTv || seedTv || undefined;
}

function normalizeGames(raw: ScheduleGame[] | undefined | null): ScheduleGame[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  const seedById = new Map(SCHEDULE_GAMES.map((g) => [g.id, g]));
  return raw
    .map((g) => {
      if (!g || typeof g !== 'object') return null;
      const id = String(g.id || '').trim();
      const opp = String(g.opp || '').trim();
      const seed = seedById.get(id);
      const date = preferKickoffDate(String(g.date || '').trim(), seed?.date);
      if (!id || !opp || !date) return null;
      const uniform = mergeUniform(g.uniform, seed?.uniform);
      const tv = preferTv(g.tv, seed?.tv);
      const predConfidence = Number(g.predConfidence ?? seed?.predConfidence);
      const predMovement = g.predMovement || seed?.predMovement;
      const ufPctDelta = Number(g.ufPctDelta ?? seed?.ufPctDelta);
      return {
        ...g,
        id,
        opp,
        date,
        ...(tv ? { tv } : {}),
        ...(Number.isFinite(predConfidence) ? { predConfidence } : {}),
        ...(predMovement === 'up' || predMovement === 'down' || predMovement === 'flat'
          ? { predMovement }
          : {}),
        ...(Number.isFinite(ufPctDelta) ? { ufPctDelta } : {}),
        label: String(g.label || id).trim(),
        venue: String(g.venue || '').trim(),
        ufPct: Number.isFinite(Number(g.ufPct)) ? Number(g.ufPct) : 50,
        keys: Array.isArray(g.keys) ? g.keys : [],
        swing: Array.isArray(g.swing) ? g.swing : [],
        ...(Array.isArray(g.radar) && g.radar.length
          ? {
              radar: g.radar
                .map((axis) => ({
                  label: String(axis?.label || '').trim(),
                  uf: Number(axis?.uf),
                  opp: Number(axis?.opp),
                }))
                .filter((axis) => axis.label && Number.isFinite(axis.uf) && Number.isFinite(axis.opp)),
            }
          : seed?.radar
            ? { radar: seed.radar }
            : {}),
        film: String(g.film || ''),
        filmNotes: Array.isArray(g.filmNotes)
          ? g.filmNotes.map((n) => String(n || '').trim()).filter(Boolean)
          : seed?.filmNotes,
        // Never refill desk scout from Capacitor seed — public API empties these
        // so current iOS falls through to fan tendencies + film.
        offenseScout: Array.isArray(g.offenseScout)
          ? g.offenseScout.map((n) => String(n || '').trim()).filter(Boolean)
          : undefined,
        defenseScout: Array.isArray(g.defenseScout)
          ? g.defenseScout.map((n) => String(n || '').trim()).filter(Boolean)
          : undefined,
        scoutingReport:
          g.scoutingReport != null && String(g.scoutingReport).trim()
            ? String(g.scoutingReport).trim()
            : undefined,
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

const LAST_GOOD_PREFIX = 'gv-schedule-board-last-good:';

let lastGoodMemory: Record<number, ScheduleBoardLive> = {};
/** This JS session already applied a live `/api/schedule` board — remaining preds are safe to paint. */
const sessionLive: Record<number, boolean> = {};

function lastGoodKey(season: number): string {
  return `${LAST_GOOD_PREFIX}${season}`;
}

function readLastGood(season: number): ScheduleBoardLive | null {
  if (lastGoodMemory[season]?.games?.length) return lastGoodMemory[season];
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(lastGoodKey(season));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScheduleBoardLive;
    const games = normalizeGames(parsed?.games);
    if (!games.length) return null;
    const currentGameId = String(parsed.currentGameId || '').trim() || undefined;
    const predThrough = String(parsed.predThrough || '').trim() || undefined;
    const board = { games, currentGameId, ...(predThrough ? { predThrough } : {}) };
    lastGoodMemory[season] = board;
    return board;
  } catch {
    return null;
  }
}

function writeLastGood(season: number, board: ScheduleBoardLive, opts?: { fromLive?: boolean }): void {
  lastGoodMemory[season] = board;
  if (opts?.fromLive) sessionLive[season] = true;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(lastGoodKey(season), JSON.stringify(board));
  } catch {
    /* quota / private mode */
  }
}

function clearLastGood(season = 2026): void {
  delete lastGoodMemory[season];
  delete sessionLive[season];
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(lastGoodKey(season));
  } catch {
    /* quota / private mode */
  }
}

export function fallbackScheduleGames(): ScheduleGame[] {
  return SCHEDULE_GAMES.slice();
}

/** Sync first paint — intel from last-good/seed; remaining scores wait for this-session live. */
export function peekScheduleBoard(season = 2026): ScheduleBoardLive {
  const last = readLastGood(season);
  const base = last || seedBoard();
  if (sessionLive[season]) return base;
  return { ...base, games: stripRemainingPreds(base.games) };
}

export async function fetchScheduleBoard(season = 2026): Promise<ScheduleBoardLive> {
  try {
    // Always await live schedule — do not return a stale SWR cache hit. Game Week
    // keys (Expected visitors, film notes) update via API without Codemagic; a
    // cache-first paint left the UI on yesterday's slate until hard refresh.
    const data = await snapshotLiveFetch<ScheduleBoardResponse>(
      `/api/schedule?year=${season}`
    );
    const live = normalizeGames(data?.games);
    const currentGameId = String(data?.currentGameId || '').trim() || undefined;
    const predThrough = String(data?.predThrough || '').trim() || undefined;
    if (live.length) {
      const board = { games: live, currentGameId, ...(predThrough ? { predThrough } : {}) };
      writeLastGood(season, board, { fromLive: true });
      return board;
    }
  } catch {
    /* fall through */
  }
  // 502 / flap: keep this-session live board. Do not paint durable leftover scores.
  if (sessionLive[season] && lastGoodMemory[season]?.games?.length) {
    return lastGoodMemory[season];
  }
  const last = readLastGood(season);
  const base = last || seedBoard();
  return { ...base, games: stripRemainingPreds(base.games) };
}

export async function fetchScheduleGames(season = 2026): Promise<ScheduleGame[]> {
  const board = await fetchScheduleBoard(season);
  return board.games;
}

/** Warm last-good from Home so Game Week opens on live keys, not the baked seed. */
export function prefetchScheduleBoard(season = 2026): void {
  if (typeof window === 'undefined') return;
  void fetchScheduleBoard(season).catch(() => {});
}

/** Test helpers */
export const __scheduleApiTest = {
  normalizeGames,
  normalizeUniform,
  mergeUniform,
  writeLastGood,
  readLastGood,
  clearLastGood,
  lastGoodKey,
  stripRemainingPreds,
};
