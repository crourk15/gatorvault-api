/**
 * Portal Intelligence repository — aggregated rows for portal engine.
 */
import { db } from './db';
import type { PlayerLifecycleStatus, PortalStatus, SignalType, UFStatus } from '../shared/enums';
import type { PortalSignalDetail } from '../../models/portal-intel-types';
import { portalDbStatuses } from '../shared/lifecycle';
import { FUTURECAST_PLAYERS_TABLE, playerFromRow, type PlayerRow } from './player-types';

export interface PortalCandidateFilters {
  class_year?: number;
  position?: string;
  limit?: number;
}

export interface PortalIntelRow {
  id: string;
  slug: string;
  full_name: string;
  class_year: number;
  position: string;
  lifecycle: PlayerLifecycleStatus;
  committed_to: string | null;
  stars: number | null;
  composite_rating: number | null;
  hometown: string | null;
  state: string | null;
  portal_status: PortalStatus | null;
  portal_likelihood_stored: number | null;
  previous_school: string | null;
  college: string | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  uf_status: UFStatus | null;
  signal_count: number;
  signal_types: SignalType[];
  signals: PortalSignalDetail[];
  college_stats: Record<string, unknown> | null;
  college_snaps: Record<string, unknown> | null;
  depth_history: unknown[] | null;
  hs_offers: unknown[];
}

type PortalIntelDbRow = PlayerRow & {
  portal_status: string | null;
  portal_likelihood_stored: number | null;
  previous_school: string | null;
  college: string | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  uf_status: string | null;
  signal_count: number;
  signal_types: string[] | null;
  signal_details: PortalSignalDetail[] | null;
  college_stats: Record<string, unknown> | null;
  college_snaps: Record<string, unknown> | null;
  depth_history: unknown[] | null;
  hs_offers: unknown[] | null;
};

function mapSignalTypes(raw: string[] | null): SignalType[] {
  return (raw ?? []).filter(Boolean) as SignalType[];
}

function mapSignalDetails(raw: PortalSignalDetail[] | null): PortalSignalDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    signal_type: s.signal_type as SignalType,
    created_at: s.created_at,
    signal_value: s.signal_value ?? {},
  }));
}

function mapPortalIntelRow(row: PortalIntelDbRow): PortalIntelRow {
  const player = playerFromRow(row);
  return {
    id: player.id,
    slug: player.slug,
    full_name: player.full_name,
    class_year: player.class_year,
    position: player.position,
    lifecycle: player.status,
    committed_to: player.committed_to,
    stars: player.stars,
    composite_rating: player.composite_rating,
    hometown: player.hometown,
    state: player.state,
    portal_status: row.portal_status ? (row.portal_status as PortalStatus) : null,
    portal_likelihood_stored: row.portal_likelihood_stored,
    previous_school: row.previous_school,
    college: row.college,
    uf_fit_score: row.uf_fit_score,
    scheme_score: row.scheme_score,
    uf_status: row.uf_status ? (row.uf_status as UFStatus) : null,
    signal_count: Number(row.signal_count) || 0,
    signal_types: mapSignalTypes(row.signal_types),
    signals: mapSignalDetails(row.signal_details),
    college_stats: row.college_stats,
    college_snaps: row.college_snaps,
    depth_history: Array.isArray(row.depth_history) ? row.depth_history : null,
    hs_offers: row.hs_offers ?? [],
  };
}

const PORTAL_INTEL_SELECT = `
  SELECT
    p.*,
    pp.portal_status,
    pp.portal_likelihood AS portal_likelihood_stored,
    pp.previous_school,
    cp.college,
    cp.stats AS college_stats,
    cp.snaps AS college_snaps,
    cp.depth_history,
    uf.uf_fit_score,
    uf.scheme_score,
    uf.uf_status,
    hs.offers AS hs_offers,
    COALESCE(sig.signal_count, 0)::int AS signal_count,
    sig.signal_types,
    sig.signal_details
  FROM ${FUTURECAST_PLAYERS_TABLE} p
  LEFT JOIN futurecast.portal_profiles pp ON pp.player_id = p.id
  LEFT JOIN futurecast.college_profiles cp ON cp.player_id = p.id
  LEFT JOIN futurecast.uf_specific_profiles uf ON uf.player_id = p.id
  LEFT JOIN futurecast.high_school_profiles hs ON hs.player_id = p.id
  LEFT JOIN (
    SELECT
      player_id,
      COUNT(*)::int AS signal_count,
      array_agg(signal_type::text ORDER BY created_at DESC) AS signal_types,
      json_agg(
        json_build_object(
          'signal_type', signal_type::text,
          'created_at', created_at,
          'signal_value', COALESCE(signal_value, '{}'::jsonb)
        )
        ORDER BY created_at DESC
      ) AS signal_details
    FROM futurecast.discovery_signals
    GROUP BY player_id
  ) sig ON sig.player_id = p.id
`;

export async function listPortalCandidates(
  filters: PortalCandidateFilters = {}
): Promise<PortalIntelRow[]> {
  const portalStatuses = [...portalDbStatuses()];
  const conditions: string[] = [`(p.status = ANY($1::text[]) OR pp.portal_status IS NOT NULL)`];
  const params: unknown[] = [portalStatuses];
  let idx = 2;

  if (filters.class_year != null) {
    conditions.push(`p.class_year = $${idx++}`);
    params.push(filters.class_year);
  }
  if (filters.position) {
    conditions.push(`p.position = $${idx++}`);
    params.push(filters.position);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await db.query<PortalIntelDbRow>(
    `
    ${PORTAL_INTEL_SELECT}
    ${where}
    ORDER BY p.class_year DESC, p.full_name ASC
    `,
    params
  );

  return rows.map(mapPortalIntelRow);
}

export async function getPortalIntelByPlayerId(playerId: string): Promise<PortalIntelRow | null> {
  const { rows } = await db.query<PortalIntelDbRow>(
    `
    ${PORTAL_INTEL_SELECT}
    WHERE p.id = $1
    LIMIT 1
    `,
    [playerId]
  );
  if (!rows.length) return null;
  return mapPortalIntelRow(rows[0]);
}

/** Destination schools chosen by players from the same previous school (portal trends). */
export async function listPeerPortalDestinations(previousSchool: string | null): Promise<string[]> {
  if (!previousSchool) return [];
  const { rows } = await db.query<{ destination_school: string }>(
    `
    SELECT DISTINCT pp.destination_school
    FROM futurecast.portal_profiles pp
    WHERE pp.previous_school = $1
      AND pp.destination_school IS NOT NULL
      AND pp.destination_school <> ''
    LIMIT 10
    `,
    [previousSchool]
  );
  return rows.map((r) => r.destination_school).filter(Boolean);
}

export function portalRowToEngineInput(row: PortalIntelRow) {
  return {
    id: row.id,
    lifecycle: row.lifecycle,
    portal_likelihood_stored: row.portal_likelihood_stored,
    signal_types: row.signal_types,
    signals: row.signals,
    depth_history: row.depth_history,
    college_stats: row.college_stats,
    college_snaps: row.college_snaps,
    stars: row.stars,
    composite_rating: row.composite_rating,
    hometown: row.hometown,
    state: row.state,
    college: row.college,
    previous_school: row.previous_school,
    uf_fit_score: row.uf_fit_score,
    scheme_score: row.scheme_score,
    uf_status: row.uf_status,
    hs_offers: row.hs_offers,
  };
}
