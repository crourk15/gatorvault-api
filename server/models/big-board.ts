/**
 * Big Board repository — aggregated player rows for ranking engine.
 * @see server/api/big-board/engine.ts
 */
import { db } from './db';
import type { PlayerLifecycleStatus, PortalStatus, SignalType, UFStatus } from '../shared/enums';
import { FUTURECAST_PLAYERS_TABLE, playerFromRow, type PlayerRow } from './player-types';

export interface BigBoardFilters {
  class_year?: number;
  position?: string;
  lifecycle?: PlayerLifecycleStatus;
}

export interface BigBoardRawPlayer {
  id: string;
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
  lifecycle: PlayerLifecycleStatus;
  portal_status: PortalStatus | null;
  portal_likelihood_stored: number | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: UFStatus | null;
  signal_count: number;
  signal_types: SignalType[];
  college_stats: Record<string, unknown> | null;
  college_snaps: Record<string, unknown> | null;
  depth_history: unknown[] | null;
}

type BigBoardRow = PlayerRow & {
  portal_status: string | null;
  portal_likelihood_stored: number | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: string | null;
  signal_count: number;
  signal_types: string[] | null;
  college_stats: Record<string, unknown> | null;
  college_snaps: Record<string, unknown> | null;
  depth_history: unknown[] | null;
};

function mapSignalTypes(raw: string[] | null): SignalType[] {
  return (raw ?? []).filter(Boolean) as SignalType[];
}

export async function listBigBoardPlayers(filters: BigBoardFilters = {}): Promise<BigBoardRawPlayer[]> {
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
  if (filters.lifecycle) {
    conditions.push(`p.status = $${idx++}`);
    params.push(filters.lifecycle);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query<BigBoardRow>(
    `
    SELECT
      p.*,
      pp.portal_status,
      pp.portal_likelihood AS portal_likelihood_stored,
      uf.uf_fit_score,
      uf.scheme_score,
      uf.character_score,
      uf.athletic_score,
      uf.timeline_score,
      uf.uf_status,
      COALESCE(sig.signal_count, 0)::int AS signal_count,
      sig.signal_types,
      cp.stats AS college_stats,
      cp.snaps AS college_snaps,
      cp.depth_history
    FROM ${FUTURECAST_PLAYERS_TABLE} p
    LEFT JOIN futurecast.portal_profiles pp ON pp.player_id = p.id
    LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
    LEFT JOIN futurecast.college_profiles cp ON cp.player_id = p.id
    LEFT JOIN (
      SELECT
        player_id,
        COUNT(*)::int AS signal_count,
        array_agg(signal_type::text ORDER BY created_at DESC) AS signal_types
      FROM futurecast.discovery_signals
      GROUP BY player_id
    ) sig ON sig.player_id = p.id
    ${where}
    ORDER BY p.class_year DESC, p.full_name ASC
    `,
    params
  );

  return rows.map((row) => {
    const player = playerFromRow(row);
    return {
      id: player.id,
      slug: player.slug,
      full_name: player.full_name,
      class_year: player.class_year,
      position: player.position,
      lifecycle: player.status,
      portal_status: row.portal_status ? (row.portal_status as PortalStatus) : null,
      portal_likelihood_stored: row.portal_likelihood_stored,
      uf_fit_score: row.uf_fit_score,
      scheme_score: row.scheme_score,
      character_score: row.character_score,
      athletic_score: row.athletic_score,
      timeline_score: row.timeline_score,
      uf_status: row.uf_status ? (row.uf_status as UFStatus) : null,
      signal_count: Number(row.signal_count) || 0,
      signal_types: mapSignalTypes(row.signal_types),
      college_stats: row.college_stats,
      college_snaps: row.college_snaps,
      depth_history: Array.isArray(row.depth_history) ? row.depth_history : null,
    };
  });
}
