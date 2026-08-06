import { loadSession } from './auth-api';
import type { ApiFetchInit } from './api-fetch';
import { snapshotLiveFetch, DEFAULT_SNAPSHOT_FETCH_OPTS } from './snapshot-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';

/** Film catalog/lessons are tier-gated on the API — send vault session when logged in. */
function filmFetchInit(init?: ApiFetchInit): ApiFetchInit {
  const session = loadSession();
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  return { ...DEFAULT_SNAPSHOT_FETCH_OPTS, ...init, headers };
}

export interface FilmRoomCatalogItem {
  id: string;
  slug?: string;
  title: string;
  dek?: string;
  category?: string;
  filmHub?: string;
  source?: string;
  sourceUrl?: string | null;
  locked?: boolean;
  season?: string;
  duration?: string;
  body?: string;
  diagram?: unknown;
  youtubeId?: string | null;
  embedUrl?: string | null;
  videoUrl?: string | null;
  knowledgeEngine?: boolean;
  gameLine?: string;
  publishedAt?: string | null;
  lastVerified?: string | null;
  noVideo?: boolean;
  sources?: { source_name?: string; sourceName?: string; source_url?: string; sourceUrl?: string }[];
}

export interface FilmRoomLessonDetail {
  ok: boolean;
  id: string;
  title: string;
  summary?: string;
  body?: string;
  diagram?: unknown;
  category?: string;
  sources?: { source_name?: string; source_url?: string }[];
  locked?: boolean;
  error?: string;
}

export interface FilmRoomCatalog {
  categories?: string[];
  items: FilmRoomCatalogItem[];
}

export async function fetchFilmRoomCatalog(): Promise<FilmRoomCatalog> {
  const data = await fetchWithWarmPoll(() =>
    snapshotLiveFetch<FilmRoomCatalog>('/api/film-room/catalog', filmFetchInit())
  );
  return { categories: data.categories, items: data.items ?? [] };
}

export async function fetchFilmRoomLesson(id: string): Promise<FilmRoomLessonDetail> {
  const data = await snapshotLiveFetch<FilmRoomLessonDetail>(
    `/api/film-room/lesson/${encodeURIComponent(id)}`,
    filmFetchInit()
  );
  return data;
}

export const FILM_HUB_ORDER = [
  'Film Breakdown',
  'Scheme School',
  'UF Press Conferences',
  'Highlights',
];

/** Map legacy / ingest hub labels onto the four Film Room rails. */
export function normalizeFilmHub(hub?: string | null): string {
  const raw = String(hub || '').trim();
  if (!raw) return 'Film Breakdown';
  if (raw === 'GNFP Film Review' || raw === 'Game Week' || /film\s*breakdown|film\s*review/i.test(raw)) {
    return 'Film Breakdown';
  }
  if (/scheme\s*school/i.test(raw)) return 'Scheme School';
  if (/press/i.test(raw)) return 'UF Press Conferences';
  if (/highlight/i.test(raw)) return 'Highlights';
  if (FILM_HUB_ORDER.includes(raw)) return raw;
  return 'Film Breakdown';
}
