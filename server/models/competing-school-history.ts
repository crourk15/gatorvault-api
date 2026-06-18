/**
 * Competing school rank history — rivals PM prediction leaderboard changes.
 */
import { db } from './db';

export interface CompetingSchoolRank {
  school: string;
  rank: number;
}

export interface CompetingSchoolDelta {
  playerId: string;
  slug: string;
  name: string;
  school: string;
  rankNow: number;
  rankPrior: number | null;
  delta: number;
  volatilityBoost: number;
}

export interface CompetingSchoolSnapshot {
  school: string;
  rankNow: number;
  rankPrior: number | null;
  delta: number;
  volatilityBoost: number;
}

export function competingVolatilityBoost(rankDelta: number): number {
  const abs = Math.abs(rankDelta);
  if (abs >= 4) return 20;
  if (abs >= 2) return 10;
  return 0;
}

export async function logCompetingSchoolRanks(
  playerId: string,
  schools: CompetingSchoolRank[]
): Promise<number> {
  if (!schools.length) return 0;
  let inserted = 0;

  for (const { school, rank } of schools) {
    const normalizedSchool = String(school || '').trim();
    if (!normalizedSchool || !Number.isFinite(rank) || rank < 1) continue;

    const { rows } = await db.query<{ rank: number }>(
      `
      SELECT rank
      FROM futurecast.competing_school_history
      WHERE player_id = $1 AND school = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [playerId, normalizedSchool]
    );

    const prior = rows[0]?.rank;
    if (prior == null || prior !== rank) {
      await db.query(
        `
        INSERT INTO futurecast.competing_school_history (player_id, school, rank)
        VALUES ($1, $2, $3)
        `,
        [playerId, normalizedSchool, rank]
      );
      inserted += 1;
    }
  }

  return inserted;
}

/** Latest rank per school for one player (7-day window deltas). */
export async function listCompetingSchoolsForPlayer(
  playerId: string,
  windowDays = 7
): Promise<CompetingSchoolSnapshot[]> {
  const days = Math.max(1, Math.floor(windowDays));
  const { rows } = await db.query<{
    school: string;
    rank_now: number;
    rank_prior: number | null;
  }>(
    `
    WITH recent AS (
      SELECT
        h.school,
        h.rank,
        h.created_at,
        ROW_NUMBER() OVER (PARTITION BY h.school ORDER BY h.created_at DESC) AS rn
      FROM futurecast.competing_school_history h
      WHERE h.player_id = $1
        AND h.created_at >= now() - ($2::int || ' days')::interval
    ),
    paired AS (
      SELECT
        r1.school,
        r1.rank AS rank_now,
        r2.rank AS rank_prior
      FROM recent r1
      LEFT JOIN recent r2 ON r2.school = r1.school AND r2.rn = 2
      WHERE r1.rn = 1
    )
    SELECT school, rank_now, rank_prior
    FROM paired
    ORDER BY rank_now ASC, school ASC
    `,
    [playerId, days]
  );

  return rows.map((row) => {
    const delta =
      row.rank_prior != null ? row.rank_prior - row.rank_now : 0;
    return {
      school: row.school,
      rankNow: row.rank_now,
      rankPrior: row.rank_prior,
      delta,
      volatilityBoost: competingVolatilityBoost(delta),
    };
  });
}

export async function listCompetingVolatilityBoosts(
  windowDays = 7
): Promise<Map<string, number>> {
  const deltas = await listCompetingSchoolDeltas(windowDays);
  const boosts = new Map<string, number>();

  for (const item of deltas) {
    const current = boosts.get(item.playerId) ?? 0;
    boosts.set(item.playerId, Math.max(current, item.volatilityBoost));
  }

  return boosts;
}

export async function listCompetingSchoolDeltas(
  windowDays = 7
): Promise<CompetingSchoolDelta[]> {
  const days = Math.max(1, Math.floor(windowDays));
  const { rows } = await db.query<{
    player_id: string;
    slug: string;
    full_name: string;
    school: string;
    rank_now: number;
    rank_prior: number | null;
  }>(
    `
    WITH recent AS (
      SELECT
        h.player_id,
        h.school,
        h.rank,
        h.created_at,
        ROW_NUMBER() OVER (
          PARTITION BY h.player_id, h.school
          ORDER BY h.created_at DESC
        ) AS rn
      FROM futurecast.competing_school_history h
      WHERE h.created_at >= now() - ($1::int || ' days')::interval
    ),
    paired AS (
      SELECT
        r1.player_id,
        r1.school,
        r1.rank AS rank_now,
        r2.rank AS rank_prior
      FROM recent r1
      LEFT JOIN recent r2
        ON r2.player_id = r1.player_id
        AND r2.school = r1.school
        AND r2.rn = 2
      WHERE r1.rn = 1
    )
    SELECT
      p.player_id,
      pl.slug,
      pl.full_name,
      p.school,
      p.rank_now,
      p.rank_prior
    FROM paired p
    JOIN futurecast.players pl ON pl.id = p.player_id
    WHERE p.rank_prior IS NOT NULL
      AND p.rank_now <> p.rank_prior
    ORDER BY ABS(p.rank_prior - p.rank_now) DESC, pl.full_name ASC
    `,
    [days]
  );

  return rows.map((row) => {
    const delta = (row.rank_prior ?? row.rank_now) - row.rank_now;
    return {
      playerId: row.player_id,
      slug: row.slug,
      name: row.full_name,
      school: row.school,
      rankNow: row.rank_now,
      rankPrior: row.rank_prior,
      delta,
      volatilityBoost: competingVolatilityBoost(delta),
    };
  });
}
