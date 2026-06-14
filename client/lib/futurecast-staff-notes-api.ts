/**
 * FutureCast Staff Notes API — live endpoint only.
 */
import { getApiBase } from './big-board-api';
import { FutureCastApiError } from './futurecast-home-api';

export const STAFF_NOTES_YEAR = 2027;
export const STAFF_NOTES_FETCH_TIMEOUT_MS = 2_500;
export const STAFF_NOTES_CLIENT_CACHE_TTL_MS = 5 * 60_000;

const CACHE_KEY = 'gv:futurecast:staff-notes:v1';

export interface FutureCastStaffNote {
  playerSlug: string;
  playerName: string;
  position: string | null;
  school: string | null;
  classYear: number | null;
  year: number | null;
  playerType: string;
  projection: string | null;
  staffNotes: string | null;
  insiderNotes: string | null;
  recruitingStory: string | null;
  comparison: string | null;
  schemeFit: string | null;
  analystName: string | null;
  notePreview: string;
  updatedAt: string | null;
}

export interface FutureCastStaffNotesResponse {
  classYear: number;
  updatedAt: string;
  count: number;
  staleFiltered?: number;
  notes: FutureCastStaffNote[];
}

export interface StaffNotesLoadMeta {
  loadMs: number;
  fromCache: boolean;
  timedOut: boolean;
  offline: boolean;
  count: number;
}

interface CachedPayload {
  savedAt: number;
  year: number;
  data: FutureCastStaffNotesResponse;
}

async function fetchWithTimeout(url: string, timeoutMs = STAFF_NOTES_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'default' });
  } finally {
    clearTimeout(timer);
  }
}

function readClientCache(): CachedPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed.year !== STAFF_NOTES_YEAR) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > STAFF_NOTES_CLIENT_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeClientCache(data: FutureCastStaffNotesResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedPayload = {
      savedAt: Date.now(),
      year: STAFF_NOTES_YEAR,
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function logStaffNotes(meta: { loadMs: number; fromCache: boolean; count: number }): void {
  if (typeof console === 'undefined') return;
  console.info(`FutureCast staff notes load: ${(meta.loadMs / 1000).toFixed(2)}s`);
  console.info(`Source: ${meta.fromCache ? 'localStorage' : 'live-api'}`);
  console.info(`Year filter: ${STAFF_NOTES_YEAR}+`);
  console.info(`Notes loaded: ${meta.count}`);
}

async function fetchStaffNotesFromApi(year = STAFF_NOTES_YEAR): Promise<FutureCastStaffNotesResponse> {
  try {
    const res = await fetchWithTimeout(
      `${getApiBase()}/api/futurecast/staff-notes?year=${year}`
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error || `API ${res.status}`;
      const code = res.status === 502 || res.status === 503 ? 'offline' : 'error';
      throw new FutureCastApiError(msg, code, res.status);
    }
    return res.json() as Promise<FutureCastStaffNotesResponse>;
  } catch (err) {
    if (err instanceof FutureCastApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FutureCastApiError('Request timed out', 'timeout');
    }
    throw err;
  }
}

export async function loadFutureCastStaffNotes(options?: {
  preferCache?: boolean;
}): Promise<{
  data: FutureCastStaffNotesResponse | null;
  meta: StaffNotesLoadMeta;
}> {
  const loadStart = performance.now();
  const cached = options?.preferCache !== false ? readClientCache() : null;

  try {
    const data = await fetchStaffNotesFromApi();
    writeClientCache(data);
    const loadMs = Math.round(performance.now() - loadStart);
    logStaffNotes({ loadMs, fromCache: false, count: data.notes.length });
    return {
      data,
      meta: {
        loadMs,
        fromCache: false,
        timedOut: false,
        offline: false,
        count: data.notes.length,
      },
    };
  } catch (err) {
    const timedOut = err instanceof FutureCastApiError && err.code === 'timeout';
    const offline = err instanceof FutureCastApiError && err.code === 'offline';
    const loadMs = Math.round(performance.now() - loadStart);

    if (cached) {
      logStaffNotes({ loadMs, fromCache: true, count: cached.data.notes.length });
      return {
        data: cached.data,
        meta: {
          loadMs,
          fromCache: true,
          timedOut,
          offline,
          count: cached.data.notes.length,
        },
      };
    }

    return {
      data: null,
      meta: {
        loadMs,
        fromCache: false,
        timedOut,
        offline,
        count: 0,
      },
    };
  }
}

export function readFutureCastStaffNotesCache(): FutureCastStaffNotesResponse | null {
  return readClientCache()?.data ?? null;
}
