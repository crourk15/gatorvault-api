/**
 * FutureCast homepage API — live endpoints only (no static JSON).
 * 2027 cycle · client cache · timeout · stale-data guard.
 */
import { getApiBase } from './big-board-api';
import type { FeedPrediction, PredictorLeaderboardEntry } from './predictions-api';
import type { MovementHeatmapBucket } from './predictions-api';

export const FUTURECAST_WIDGET_YEAR = 2027;
export const FUTURECAST_FETCH_TIMEOUT_MS = 2_500;
export const FUTURECAST_CLIENT_CACHE_TTL_MS = 5 * 60_000;

const CACHE_KEY = 'gv:futurecast:widget:v2';

export type CommitSort = 'fit' | 'stability';

export interface TrendHistoryPoint {
  date: string;
  confidence: number;
}

export interface FeedPredictionWithHistory extends FeedPrediction {
  trendHistory?: TrendHistoryPoint[];
}

export interface FutureCastClassResponse {
  classYear: number;
  commitCount: number;
  targetCount: number;
  blueChips: number;
  inStatePct: number;
  rankings: {
    nationalRank: number | null;
    secRank: number | null;
    classScore: number | null;
    source: string | null;
    updatedAt: string | null;
  } | null;
  classImpactScore: number | null;
  teamImpactScore: number | null;
}

export interface FutureCastPredictionsResponse {
  classYear: number;
  predictions: FeedPredictionWithHistory[];
  predictors: PredictorLeaderboardEntry[];
  windowDays: number;
}

export interface PortalWatchlistHomePlayer {
  id: string;
  fullName: string;
  slug: string;
  position: string;
  classYear: number;
  portalLikelihood: number;
  depthChartRisk: number;
  volatility: number;
  rank: number;
}

export interface FutureCastHomeResponse {
  classYear: number;
  commitSort: CommitSort;
  heatmap: {
    buckets: MovementHeatmapBucket[];
    windowDays: number;
  };
  commits: FeedPrediction[];
  commitTotal?: number;
  topTargets: FeedPrediction[];
  trendingUp: FeedPrediction[];
  trendingDown: FeedPrediction[];
  portalWatchlist: PortalWatchlistHomePlayer[];
}

export interface FutureCastWidgetBundle {
  home: FutureCastHomeResponse;
  classData: FutureCastClassResponse;
  predictions: FutureCastPredictionsResponse;
}

export interface FutureCastWidgetLoadMeta {
  loadMs: number;
  apiMs: number;
  fromCache: boolean;
  timedOut: boolean;
  offline: boolean;
  staleFiltered: number;
  year: number;
  predictionsLoaded: number;
  errorCode?: 'timeout' | 'offline' | 'error';
}

export class FutureCastApiError extends Error {
  readonly code: 'timeout' | 'offline' | 'error';
  readonly status?: number;

  constructor(message: string, code: 'timeout' | 'offline' | 'error', status?: number) {
    super(message);
    this.name = 'FutureCastApiError';
    this.code = code;
    this.status = status;
  }
}

interface CachedBundle {
  savedAt: number;
  year: number;
  bundle: FutureCastWidgetBundle;
}

function logWidgetLoad(meta: {
  loadMs: number;
  fromCache: boolean;
  predictionsLoaded: number;
  staleFiltered: number;
}): void {
  if (typeof console === 'undefined') return;
  console.info(`FutureCast load: ${(meta.loadMs / 1000).toFixed(2)}s`);
  console.info(`Source: ${meta.fromCache ? 'localStorage' : 'live-api'}`);
  console.info(`Year filter: ${FUTURECAST_WIDGET_YEAR}`);
  console.info(`Predictions loaded: ${meta.predictionsLoaded}`);
  if (meta.staleFiltered > 0) {
    console.info(`Stale rows filtered: ${meta.staleFiltered}`);
  }
}

function playerYear(row: { classYear?: number | null }): number | null {
  const y = row.classYear;
  return typeof y === 'number' && Number.isFinite(y) ? y : null;
}

function isStaleRow(row: { classYear?: number | null }): boolean {
  const y = playerYear(row);
  return y != null && y !== FUTURECAST_WIDGET_YEAR;
}

function filterPlayerRows<T extends { classYear?: number | null }>(rows: T[]): { rows: T[]; dropped: number } {
  const kept = rows.filter((r) => !isStaleRow(r));
  return { rows: kept, dropped: rows.length - kept.length };
}

export function sanitizeFutureCastHome(data: FutureCastHomeResponse): { data: FutureCastHomeResponse; dropped: number } {
  let dropped = 0;
  const commits = filterPlayerRows(data.commits ?? []);
  const topTargets = filterPlayerRows(data.topTargets ?? []);
  const trendingUp = filterPlayerRows(data.trendingUp ?? []);
  const trendingDown = filterPlayerRows(data.trendingDown ?? []);
  const portalWatchlist = filterPlayerRows(data.portalWatchlist ?? []);
  dropped +=
    commits.dropped +
    topTargets.dropped +
    trendingUp.dropped +
    trendingDown.dropped +
    portalWatchlist.dropped;

  if (data.classYear !== FUTURECAST_WIDGET_YEAR) {
    console.info(`FutureCast year-mismatch: home response ${data.classYear}`);
  }

  return {
    data: {
      ...data,
      classYear: FUTURECAST_WIDGET_YEAR,
      commits: commits.rows,
      topTargets: topTargets.rows,
      trendingUp: trendingUp.rows,
      trendingDown: trendingDown.rows,
      portalWatchlist: portalWatchlist.rows,
    },
    dropped,
  };
}

export function sanitizeFutureCastClass(data: FutureCastClassResponse): FutureCastClassResponse {
  if (data.classYear !== FUTURECAST_WIDGET_YEAR) {
    console.info(`FutureCast year-mismatch: class response ${data.classYear}`);
  }
  return { ...data, classYear: FUTURECAST_WIDGET_YEAR };
}

export function sanitizeFutureCastPredictions(
  data: FutureCastPredictionsResponse
): { data: FutureCastPredictionsResponse; dropped: number } {
  const filtered = filterPlayerRows(data.predictions ?? []);
  if (data.classYear !== FUTURECAST_WIDGET_YEAR) {
    console.info(`FutureCast year-mismatch: predictions response ${data.classYear}`);
  }
  return {
    data: {
      ...data,
      classYear: FUTURECAST_WIDGET_YEAR,
      predictions: filtered.rows,
    },
    dropped: filtered.dropped,
  };
}

function readClientCache(): CachedBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBundle;
    if (parsed.year !== FUTURECAST_WIDGET_YEAR) {
      localStorage.removeItem(CACHE_KEY);
      console.info(`FutureCast stale-cache-year: ${parsed.year}`);
      return null;
    }
    if (Date.now() - parsed.savedAt > FUTURECAST_CLIENT_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeClientCache(bundle: FutureCastWidgetBundle): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedBundle = {
      savedAt: Date.now(),
      year: FUTURECAST_WIDGET_YEAR,
      bundle,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

async function fetchWithTimeout(url: string, timeoutMs = FUTURECAST_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'default' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error || `API ${res.status}`;
      const code = res.status === 502 || res.status === 503 ? 'offline' : 'error';
      throw new FutureCastApiError(msg, code, res.status);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof FutureCastApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FutureCastApiError('Request timed out', 'timeout');
    }
    throw err;
  }
}

export async function fetchFutureCastHome(
  commitSort: CommitSort = 'fit'
): Promise<FutureCastHomeResponse> {
  const params = new URLSearchParams();
  if (commitSort === 'stability') params.set('commitSort', 'stability');
  const qs = params.toString();
  const data = await fetchJson<FutureCastHomeResponse>(
    `${getApiBase()}/api/futurecast/home${qs ? `?${qs}` : ''}`
  );
  return sanitizeFutureCastHome(data).data;
}

export async function fetchFutureCastClass(
  year = FUTURECAST_WIDGET_YEAR
): Promise<FutureCastClassResponse> {
  const data = await fetchJson<FutureCastClassResponse>(
    `${getApiBase()}/api/futurecast/class?year=${year}`
  );
  return sanitizeFutureCastClass(data);
}

export async function fetchFutureCastPredictions(
  year = FUTURECAST_WIDGET_YEAR,
  limit = 6
): Promise<FutureCastPredictionsResponse> {
  const params = new URLSearchParams({ year: String(year), limit: String(limit) });
  const data = await fetchJson<FutureCastPredictionsResponse>(
    `${getApiBase()}/api/futurecast/predictions?${params}`
  );
  return sanitizeFutureCastPredictions(data).data;
}

/**
 * Load all three homepage widget endpoints in parallel with timeout + cache.
 */
export async function loadFutureCastWidgetBundle(options?: {
  predictionsLimit?: number;
  preferCache?: boolean;
}): Promise<{ bundle: FutureCastWidgetBundle | null; meta: FutureCastWidgetLoadMeta }> {
  const predictionsLimit = options?.predictionsLimit ?? 6;
  const loadStart = performance.now();
  const cached = options?.preferCache !== false ? readClientCache() : null;

  const apiStart = performance.now();
  let timedOut = false;
  let offline = false;
  let errorCode: FutureCastWidgetLoadMeta['errorCode'];
  let staleFiltered = 0;

  try {
    const [homeRaw, classRaw, predRaw] = await Promise.all([
      fetchJson<FutureCastHomeResponse>(`${getApiBase()}/api/futurecast/home`),
      fetchJson<FutureCastClassResponse>(
        `${getApiBase()}/api/futurecast/class?year=${FUTURECAST_WIDGET_YEAR}`
      ),
      fetchJson<FutureCastPredictionsResponse>(
        `${getApiBase()}/api/futurecast/predictions?year=${FUTURECAST_WIDGET_YEAR}&limit=${predictionsLimit}`
      ),
    ]);

    const homeSan = sanitizeFutureCastHome(homeRaw);
    const predSan = sanitizeFutureCastPredictions(predRaw);
    staleFiltered = homeSan.dropped + predSan.dropped;

    const bundle: FutureCastWidgetBundle = {
      home: homeSan.data,
      classData: sanitizeFutureCastClass(classRaw),
      predictions: predSan.data,
    };

    writeClientCache(bundle);

    const apiMs = Math.round(performance.now() - apiStart);
    const loadMs = Math.round(performance.now() - loadStart);
    const predictionsLoaded = bundle.predictions.predictions.length;

    logWidgetLoad({
      loadMs,
      fromCache: false,
      predictionsLoaded,
      staleFiltered,
    });

    return {
      bundle,
      meta: {
        loadMs,
        apiMs,
        fromCache: false,
        timedOut: false,
        offline: false,
        staleFiltered,
        year: FUTURECAST_WIDGET_YEAR,
        predictionsLoaded,
      },
    };
  } catch (err) {
    timedOut = err instanceof FutureCastApiError && err.code === 'timeout';
    offline = err instanceof FutureCastApiError && err.code === 'offline';
    errorCode = err instanceof FutureCastApiError ? err.code : 'error';
    const apiMs = Math.round(performance.now() - apiStart);
    const loadMs = Math.round(performance.now() - loadStart);

    if (timedOut) {
      console.info(`FutureCast timeout after ${(loadMs / 1000).toFixed(2)}s`);
    } else if (offline) {
      console.info('FutureCast temporarily offline (502/503)');
    }

    if (cached) {
      const predictionsLoaded = cached.bundle.predictions.predictions.length;
      logWidgetLoad({
        loadMs,
        fromCache: true,
        predictionsLoaded,
        staleFiltered: 0,
      });
      return {
        bundle: cached.bundle,
        meta: {
          loadMs,
          apiMs,
          fromCache: true,
          timedOut,
          offline,
          staleFiltered: 0,
          year: FUTURECAST_WIDGET_YEAR,
          predictionsLoaded,
          errorCode,
        },
      };
    }

    return {
      bundle: null,
      meta: {
        loadMs,
        apiMs,
        fromCache: false,
        timedOut,
        offline,
        staleFiltered,
        year: FUTURECAST_WIDGET_YEAR,
        predictionsLoaded: 0,
        errorCode,
      },
    };
  }
}

export function readFutureCastWidgetCache(): FutureCastWidgetBundle | null {
  return readClientCache()?.bundle ?? null;
}
