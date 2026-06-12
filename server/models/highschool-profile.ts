/**
 * HighSchoolProfile repository — CRUD against futurecast.high_school_profiles.
 * @see server/docs/futurecast-platform-spec.md §1.2
 * @see server/migrations/002_create_high_school_profiles_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_HS_PROFILES_TABLE,
  type HighSchoolProfile,
  type HighSchoolProfileInsert,
  type HighSchoolProfileRow,
  type HighSchoolProfileUpdate,
  hsProfileFromRow,
  hsProfileToRow,
} from './highschool-profile-types';

export * from './highschool-profile-types';

const TABLE = FUTURECAST_HS_PROFILES_TABLE;

export async function getHighSchoolProfileByPlayerId(
  playerId: string
): Promise<HighSchoolProfile | null> {
  const { rows } = await db.query<HighSchoolProfileRow>(
    `SELECT * FROM ${TABLE} WHERE player_id = $1 LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return hsProfileFromRow(rows[0]);
}

export async function upsertHighSchoolProfile(
  data: HighSchoolProfileInsert | HighSchoolProfileUpdate
): Promise<HighSchoolProfile> {
  const row = hsProfileToRow(data);
  if (!row.player_id) {
    throw new Error('upsertHighSchoolProfile requires player_id for ON CONFLICT (player_id)');
  }

  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('upsertHighSchoolProfile requires at least one field');
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

  const { rows } = await db.query<HighSchoolProfileRow>(
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
    const existing = await getHighSchoolProfileByPlayerId(String(row.player_id));
    if (!existing) {
      throw new Error(`upsertHighSchoolProfile failed for player_id: ${row.player_id}`);
    }
    return existing;
  }

  return hsProfileFromRow(rows[0]);
}

export async function updateDiscoveryScore(playerId: string, score: number): Promise<void> {
  await db.query(
    `UPDATE ${TABLE} SET discovery_score = $2 WHERE player_id = $1`,
    [playerId, score]
  );
}
