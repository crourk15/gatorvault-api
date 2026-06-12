/**
 * CollegeProfile repository — CRUD against futurecast.college_profiles.
 * @see server/docs/futurecast-platform-spec.md §1.3
 * @see server/migrations/003_create_college_profiles_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_COLLEGE_PROFILES_TABLE,
  type CollegeProfile,
  type CollegeProfileInsert,
  type CollegeProfileRow,
  type CollegeProfileUpdate,
  collegeProfileFromRow,
  collegeProfileToRow,
} from './college-profile-types';

export * from './college-profile-types';

const TABLE = FUTURECAST_COLLEGE_PROFILES_TABLE;

export async function getCollegeProfileByPlayerId(
  playerId: string
): Promise<CollegeProfile | null> {
  const { rows } = await db.query<CollegeProfileRow>(
    `SELECT * FROM ${TABLE} WHERE player_id = $1 LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return collegeProfileFromRow(rows[0]);
}

export async function upsertCollegeProfile(
  data: CollegeProfileInsert | CollegeProfileUpdate
): Promise<CollegeProfile> {
  const row = collegeProfileToRow(data);
  if (!row.player_id) {
    throw new Error('upsertCollegeProfile requires player_id for ON CONFLICT (player_id)');
  }

  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('upsertCollegeProfile requires at least one field');
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

  const { rows } = await db.query<CollegeProfileRow>(
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
    const existing = await getCollegeProfileByPlayerId(String(row.player_id));
    if (!existing) {
      throw new Error(`upsertCollegeProfile failed for player_id: ${row.player_id}`);
    }
    return existing;
  }

  return collegeProfileFromRow(rows[0]);
}
