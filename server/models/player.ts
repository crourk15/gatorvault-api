/**
 * Player repository — CRUD against futurecast.players.
 * @see server/docs/futurecast-platform-spec.md §1.1
 * @see server/migrations/001_create_player_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_PLAYERS_TABLE,
  type ListPlayersFilters,
  type Player,
  type PlayerInsert,
  type PlayerRow,
  type PlayerSummary,
  type PlayerUpdate,
  playerFromRow,
  playerToRow,
} from './player-types';

export * from './player-types';

const TABLE = FUTURECAST_PLAYERS_TABLE;

export async function getPlayerById(id: string): Promise<Player | null> {
  const { rows } = await db.query<PlayerRow>(
    `SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;
  return playerFromRow(rows[0]);
}

export async function getPlayerBySlug(slug: string): Promise<Player | null> {
  const { rows } = await db.query<PlayerRow>(
    `SELECT * FROM ${TABLE} WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  if (rows.length === 0) return null;
  return playerFromRow(rows[0]);
}

export async function listPlayers(filters: ListPlayersFilters = {}): Promise<Player[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.class_year != null) {
    conditions.push(`p.class_year = $${idx++}`);
    params.push(filters.class_year);
  }
  if (filters.position) {
    conditions.push(`p.position = $${idx++}`);
    params.push(filters.position);
  }
  if (filters.status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.portal_status) {
    conditions.push(`pp.portal_status = $${idx++}`);
    params.push(filters.portal_status);
  }
  if (filters.uf_status) {
    conditions.push(`uf.uf_status = $${idx++}`);
    params.push(filters.uf_status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  params.push(limit, offset);

  const joinPortal = filters.portal_status ? 'INNER' : 'LEFT';
  const joinUf = filters.uf_status ? 'INNER' : 'LEFT';

  const { rows } = await db.query<PlayerRow>(
    `
    SELECT p.*
    FROM ${TABLE} p
    ${joinPortal} JOIN futurecast.portal_profiles pp ON pp.player_id = p.id
    ${joinUf} JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    ${where}
    ORDER BY p.class_year DESC, p.full_name ASC
    LIMIT $${idx++}
    OFFSET $${idx++}
    `,
    params
  );

  return rows.map(playerFromRow);
}

type PlayerSummaryRow = PlayerRow & {
  has_high_school_profile: boolean;
  has_college_profile: boolean;
  has_portal_profile: boolean;
  signal_count: number;
};

export async function listPlayerSummaries(filters: ListPlayersFilters = {}): Promise<PlayerSummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.class_year != null) {
    conditions.push(`p.class_year = $${idx++}`);
    params.push(filters.class_year);
  }
  if (filters.position) {
    conditions.push(`p.position = $${idx++}`);
    params.push(filters.position);
  }
  if (filters.status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.portal_status) {
    conditions.push(`pp.portal_status = $${idx++}`);
    params.push(filters.portal_status);
  }
  if (filters.uf_status) {
    conditions.push(`uf.uf_status = $${idx++}`);
    params.push(filters.uf_status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  params.push(limit, offset);

  const joinPortal = filters.portal_status ? 'INNER' : 'LEFT';
  const joinUf = filters.uf_status ? 'INNER' : 'LEFT';

  const { rows } = await db.query<PlayerSummaryRow>(
    `
    SELECT
      p.*,
      (hs.player_id IS NOT NULL) AS has_high_school_profile,
      (cp.player_id IS NOT NULL) AS has_college_profile,
      (pp.player_id IS NOT NULL) AS has_portal_profile,
      COALESCE(sig.signal_count, 0)::int AS signal_count
    FROM ${TABLE} p
    LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
    LEFT JOIN futurecast.college_profiles cp ON cp.player_id = p.id
    ${joinPortal} JOIN futurecast.portal_profiles pp ON pp.player_id = p.id
    ${joinUf} JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    LEFT JOIN (
      SELECT player_id, COUNT(*)::int AS signal_count
      FROM futurecast.discovery_signals
      GROUP BY player_id
    ) sig ON sig.player_id = p.id
    ${where}
    ORDER BY p.class_year DESC, p.full_name ASC
    LIMIT $${idx++}
    OFFSET $${idx++}
    `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    full_name: row.full_name,
    position: row.position,
    class_year: row.class_year,
    status: playerFromRow(row).status,
    has_high_school_profile: !!row.has_high_school_profile,
    has_college_profile: !!row.has_college_profile,
    has_portal_profile: !!row.has_portal_profile,
    signal_count: Number(row.signal_count) || 0,
  }));
}

export async function upsertPlayer(data: PlayerInsert | PlayerUpdate): Promise<Player> {
  const row = playerToRow(data);
  if (!row.slug) {
    throw new Error('upsertPlayer requires slug for ON CONFLICT (slug)');
  }

  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('upsertPlayer requires at least one field');
  }

  const values = columns.map((col) => row[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns
    .filter((col) => col !== 'slug')
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const conflictClause = updates
    ? `DO UPDATE SET ${updates}`
    : 'DO NOTHING';

  const { rows } = await db.query<PlayerRow>(
    `
    INSERT INTO ${TABLE} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (slug)
    ${conflictClause}
    RETURNING *
    `,
    values
  );

  if (rows.length === 0) {
    const existing = await getPlayerBySlug(String(row.slug));
    if (!existing) {
      throw new Error(`upsertPlayer failed for slug: ${row.slug}`);
    }
    return existing;
  }

  return playerFromRow(rows[0]);
}
