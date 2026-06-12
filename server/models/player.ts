/**
 * Player — canonical athlete identity.
 * @see server/docs/futurecast-platform-spec.md §1.1
 */

export interface Player {
  id: string;
  slug: string;
  name: string;
  preferred_name: string | null;
  positions: string[];
  primary_position: string;
  height: number;
  weight: number;
  dob: string | null;
  hometown_city: string;
  hometown_state: string;
  country: string;
  photo_url: string | null;
  class_year: number;
  created_at: string;
  updated_at: string;
}

// TODO(Phase 1): implement Postgres repository
export async function getPlayerById(_id: string): Promise<Player | null> {
  throw new Error('TODO: implement getPlayerById — spec §1.1');
}

export async function getPlayerBySlug(_slug: string): Promise<Player | null> {
  throw new Error('TODO: implement getPlayerBySlug — spec §1.1');
}

export async function upsertPlayer(_player: Partial<Player> & Pick<Player, 'slug' | 'name' | 'class_year'>): Promise<Player> {
  throw new Error('TODO: implement upsertPlayer — spec §2.1 roster ingestion');
}

export async function listPlayers(_filters: Record<string, unknown>): Promise<Player[]> {
  throw new Error('TODO: implement listPlayers — spec §3.1');
}
