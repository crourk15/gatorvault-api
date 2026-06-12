/**
 * UFSpecificProfile repository — CRUD against futurecast.uf_specific_profiles.
 * @see server/docs/futurecast-platform-spec.md §1.5
 * @see server/migrations/005_create_uf_specific_profiles_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_UF_PROFILES_TABLE,
  type UFSpecificProfile,
  type UFSpecificProfileInsert,
  type UFSpecificProfileRow,
  type UFSpecificProfileUpdate,
  type UFStatus,
  ufSpecificProfileFromRow,
  ufSpecificProfileToRow,
} from './uf-specific-profile-types';

export * from './uf-specific-profile-types';

const TABLE = FUTURECAST_UF_PROFILES_TABLE;

export async function getUFSpecificProfileByPlayerId(
  playerId: string
): Promise<UFSpecificProfile | null> {
  const { rows } = await db.query<UFSpecificProfileRow>(
    `SELECT * FROM ${TABLE} WHERE player_id = $1 LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return ufSpecificProfileFromRow(rows[0]);
}

/** @deprecated Use getUFSpecificProfileByPlayerId */
export const getUFProfileByPlayerId = getUFSpecificProfileByPlayerId;

export async function upsertUFSpecificProfile(
  data: UFSpecificProfileInsert | UFSpecificProfileUpdate
): Promise<UFSpecificProfile> {
  const row = ufSpecificProfileToRow(data);
  if (!row.player_id) {
    throw new Error('upsertUFSpecificProfile requires player_id for ON CONFLICT (player_id)');
  }

  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('upsertUFSpecificProfile requires at least one field');
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

  const { rows } = await db.query<UFSpecificProfileRow>(
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
    const existing = await getUFSpecificProfileByPlayerId(String(row.player_id));
    if (!existing) {
      throw new Error(`upsertUFSpecificProfile failed for player_id: ${row.player_id}`);
    }
    return existing;
  }

  return ufSpecificProfileFromRow(rows[0]);
}

/** @deprecated Use upsertUFSpecificProfile */
export const upsertUFProfile = upsertUFSpecificProfile;

export async function updateUfStatus(playerId: string, status: UFStatus): Promise<void> {
  await db.query(
    `UPDATE ${TABLE} SET uf_status = $2 WHERE player_id = $1`,
    [playerId, status]
  );
}
