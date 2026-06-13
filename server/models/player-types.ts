/**
 * Player types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.1
 * @see server/migrations/001_create_player_table.sql
 */

import { PLAYER_LIFECYCLE, type PlayerLifecycleStatus, type PortalStatus, type UFStatus } from '../shared/enums';

export type { PlayerLifecycleStatus };
export { PLAYER_LIFECYCLE };

/** @deprecated Use PlayerLifecycleStatus — distinct from shared PlayerStatus (ACTIVE, etc.). */
export type PlayerStatus = PlayerLifecycleStatus;

export const PLAYER_STATUSES = PLAYER_LIFECYCLE;

/** Supabase/Postgres table (futurecast schema — see migrations README). */
export const FUTURECAST_PLAYERS_TABLE = 'futurecast.players';

export interface Player {
  id: string;
  slug: string;
  full_name: string;
  position: string;
  class_year: number;
  height: number | null;
  weight: number | null;
  hometown: string | null;
  state: string | null;
  high_school: string | null;
  stars: number | null;
  composite_rating: number | null;
  ranking_national: number | null;
  ranking_position: number | null;
  ranking_state: number | null;
  status: PlayerStatus;
  committed_to: string | null;
  created_at: string;
  updated_at: string;
  fit_scheme?: number | null;
  fit_culture?: number | null;
  fit_staff?: number | null;
  fit_need?: number | null;
  fit_geo?: number | null;
}

/** Fields required to insert a new player row. */
export type PlayerInsert = Pick<Player, 'slug' | 'full_name' | 'position' | 'class_year' | 'status'> &
  Partial<Omit<Player, 'id' | 'slug' | 'full_name' | 'position' | 'class_year' | 'status' | 'created_at' | 'updated_at'>>;

export type PlayerUpdate = Partial<Omit<Player, 'id' | 'created_at' | 'updated_at'>>;

export interface ListPlayersFilters {
  class_year?: number;
  position?: string;
  status?: PlayerStatus;
  portal_status?: PortalStatus;
  uf_status?: UFStatus;
  limit?: number;
  offset?: number;
}

export interface PlayerSummary {
  id: string;
  slug: string;
  full_name: string;
  position: string;
  class_year: number;
  status: PlayerStatus;
  has_high_school_profile: boolean;
  has_college_profile: boolean;
  has_portal_profile: boolean;
  signal_count: number;
}

export type PlayerRow = {
  id: string;
  slug: string;
  full_name: string;
  position: string;
  class_year: number;
  height: number | null;
  weight: number | null;
  hometown: string | null;
  state: string | null;
  high_school: string | null;
  stars: number | null;
  composite_rating: number | string | null;
  ranking_national: number | null;
  ranking_position: number | null;
  ranking_state: number | null;
  status: string;
  committed_to: string | null;
  created_at: string;
  updated_at: string;
  fit_scheme?: number | null;
  fit_culture?: number | null;
  fit_staff?: number | null;
  fit_need?: number | null;
  fit_geo?: number | null;
};

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertPlayerStatus(value: string): PlayerStatus {
  if ((PLAYER_STATUSES as readonly string[]).includes(value)) {
    return value as PlayerStatus;
  }
  throw new Error(`Invalid player status: ${value}`);
}

/** Map a Postgres row to the Player domain type. */
export function playerFromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    slug: row.slug,
    full_name: row.full_name,
    position: row.position,
    class_year: row.class_year,
    height: row.height,
    weight: row.weight,
    hometown: row.hometown,
    state: row.state,
    high_school: row.high_school,
    stars: row.stars,
    composite_rating: toNumberOrNull(row.composite_rating),
    ranking_national: row.ranking_national,
    ranking_position: row.ranking_position,
    ranking_state: row.ranking_state,
    status: assertPlayerStatus(row.status),
    committed_to: row.committed_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fit_scheme: row.fit_scheme ?? null,
    fit_culture: row.fit_culture ?? null,
    fit_staff: row.fit_staff ?? null,
    fit_need: row.fit_need ?? null,
    fit_geo: row.fit_geo ?? null,
  };
}

/** Map a Player insert/update payload to Postgres column names. */
export function playerToRow(player: PlayerInsert | PlayerUpdate): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('slug' in player && player.slug !== undefined) out.slug = player.slug;
  if ('full_name' in player && player.full_name !== undefined) out.full_name = player.full_name;
  if ('position' in player && player.position !== undefined) out.position = player.position;
  if ('class_year' in player && player.class_year !== undefined) out.class_year = player.class_year;
  if ('height' in player) out.height = player.height ?? null;
  if ('weight' in player) out.weight = player.weight ?? null;
  if ('hometown' in player) out.hometown = player.hometown ?? null;
  if ('state' in player) out.state = player.state ?? null;
  if ('high_school' in player) out.high_school = player.high_school ?? null;
  if ('stars' in player) out.stars = player.stars ?? null;
  if ('composite_rating' in player) out.composite_rating = player.composite_rating ?? null;
  if ('ranking_national' in player) out.ranking_national = player.ranking_national ?? null;
  if ('ranking_position' in player) out.ranking_position = player.ranking_position ?? null;
  if ('ranking_state' in player) out.ranking_state = player.ranking_state ?? null;
  if ('status' in player && player.status !== undefined) out.status = player.status;
  if ('committed_to' in player) out.committed_to = player.committed_to ?? null;
  return out;
}
