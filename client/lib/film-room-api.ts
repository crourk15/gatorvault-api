import { getApiBase } from './big-board-api';

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
  const res = await fetch(`${getApiBase()}/api/film-room/catalog`);
  if (!res.ok) throw new Error(`Film Room catalog ${res.status}`);
  const data = (await res.json()) as FilmRoomCatalog;
  return { categories: data.categories, items: data.items ?? [] };
}

export const FILM_HUB_ORDER = [
  'Offensive Scheme',
  'Defensive Scheme',
  'Film Breakdown',
  'UF Press Conferences',
  'Highlights',
];
