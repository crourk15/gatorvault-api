import seedJson from './film-room-hub-seed.json';
import type { FilmRoomCatalog, FilmRoomCatalogItem } from './film-room-api';

export type FilmRoomHubSeed = {
  generatedAt: string;
  source: string;
  categories: string[];
  items: FilmRoomCatalogItem[];
};

export const FILM_ROOM_HUB_SEED = seedJson as FilmRoomHubSeed;

/** Static first-paint Film Room catalog — replaced by live refresh after hydrate. */
export function buildSeedFilmRoomCatalog(): FilmRoomCatalog {
  return {
    categories: Array.isArray(FILM_ROOM_HUB_SEED.categories) ? FILM_ROOM_HUB_SEED.categories : [],
    items: Array.isArray(FILM_ROOM_HUB_SEED.items) ? FILM_ROOM_HUB_SEED.items : [],
  };
}
