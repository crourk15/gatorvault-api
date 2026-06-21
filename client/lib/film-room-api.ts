import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

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
}

export interface FilmRoomCatalog {
  categories?: string[];
  items: FilmRoomCatalogItem[];
}

export async function fetchFilmRoomCatalog(): Promise<FilmRoomCatalog> {
  const data = await snapshotFirstFetch('/api/film-room/catalog', () =>
    snapshotLiveFetch<FilmRoomCatalog>('/api/film-room/catalog')
  );
  return { categories: data.categories, items: data.items ?? [] };
}

export const FILM_HUB_ORDER = [
  'Offensive Scheme',
  'Defensive Scheme',
  'Film Breakdown',
  'UF Press Conferences',
  'Highlights',
];
