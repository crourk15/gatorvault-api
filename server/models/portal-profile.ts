/**
 * PortalProfile repository — CRUD against futurecast.portal_profiles.
 * @see server/docs/futurecast-platform-spec.md §1.4
 * @see server/migrations/004_create_portal_profiles_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_PORTAL_PROFILES_TABLE,
  type PortalProfile,
  type PortalProfileInsert,
  type PortalProfileRow,
  type PortalProfileUpdate,
  portalProfileFromRow,
  portalProfileToRow,
} from './portal-profile-types';

export * from './portal-profile-types';

const TABLE = FUTURECAST_PORTAL_PROFILES_TABLE;

export async function getPortalProfileByPlayerId(
  playerId: string
): Promise<PortalProfile | null> {
  const { rows } = await db.query<PortalProfileRow>(
    `SELECT * FROM ${TABLE} WHERE player_id = $1 LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return portalProfileFromRow(rows[0]);
}

export async function upsertPortalProfile(
  data: PortalProfileInsert | PortalProfileUpdate
): Promise<PortalProfile> {
  const row = portalProfileToRow(data);
  if (!row.player_id) {
    throw new Error('upsertPortalProfile requires player_id for ON CONFLICT (player_id)');
  }

  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('upsertPortalProfile requires at least one field');
  }

  const values = columns.map((col) => row[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns
    .filter((col) => col !== 'player_id')
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const conflictClause = updates
    ? `DO UPDATE SET ${updates}`
    : 'DO NOTHING';

  const { rows } = await db.query<PortalProfileRow>(
    `
    INSERT INTO ${TABLE} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (player_id)
    ${conflictClause}
    RETURNING *
    `,
    values
  );

  if (rows.length === 0) {
    const existing = await getPortalProfileByPlayerId(String(row.player_id));
    if (!existing) {
      throw new Error(`upsertPortalProfile failed for player_id: ${row.player_id}`);
    }
    return existing;
  }

  return portalProfileFromRow(rows[0]);
}

export async function listPortalWatchlist(_filters: Record<string, unknown>): Promise<PortalProfile[]> {
  throw new Error('TODO: implement listPortalWatchlist — spec §3.3');
}
