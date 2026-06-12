/**
 * PortalProfile types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.4
 * @see server/migrations/004_create_portal_profiles_table.sql
 */

import { PORTAL_STATUS, type PortalStatus } from '../shared/enums';

export type { PortalStatus };
export const PORTAL_STATUSES = PORTAL_STATUS;

export const FUTURECAST_PORTAL_PROFILES_TABLE = 'futurecast.portal_profiles';

export interface PortalProfile {
  id: string;
  player_id: string;
  previous_school: string | null;
  entered_portal_at: string | null;
  exited_portal_at: string | null;
  portal_status: PortalStatus;
  destination_school: string | null;
  eligibility_remaining: number | null;
  reason_tags: string[];
  portal_likelihood: number | null;
  likelihood_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type PortalProfileInsert = Omit<PortalProfile, 'id' | 'created_at' | 'updated_at'>;

export type PortalProfileUpdate = Partial<Omit<PortalProfile, 'id' | 'player_id' | 'created_at' | 'updated_at'>>;

export type PortalProfileRow = {
  id: string;
  player_id: string;
  previous_school: string | null;
  entered_portal_at: string | null;
  exited_portal_at: string | null;
  portal_status: string;
  destination_school: string | null;
  eligibility_remaining: number | null;
  reason_tags: string[] | null;
  portal_likelihood: number | null;
  likelihood_reason: string | null;
  created_at: string;
  updated_at: string;
};

function assertPortalStatus(value: string): PortalStatus {
  if ((PORTAL_STATUSES as readonly string[]).includes(value)) {
    return value as PortalStatus;
  }
  throw new Error(`Invalid portal status: ${value}`);
}

export function portalProfileFromRow(row: PortalProfileRow): PortalProfile {
  return {
    id: row.id,
    player_id: row.player_id,
    previous_school: row.previous_school,
    entered_portal_at: row.entered_portal_at,
    exited_portal_at: row.exited_portal_at,
    portal_status: assertPortalStatus(row.portal_status),
    destination_school: row.destination_school,
    eligibility_remaining: row.eligibility_remaining,
    reason_tags: row.reason_tags ?? [],
    portal_likelihood: row.portal_likelihood,
    likelihood_reason: row.likelihood_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function portalProfileToRow(
  profile: PortalProfileInsert | PortalProfileUpdate
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('player_id' in profile && profile.player_id !== undefined) out.player_id = profile.player_id;
  if ('previous_school' in profile) out.previous_school = profile.previous_school ?? null;
  if ('entered_portal_at' in profile) out.entered_portal_at = profile.entered_portal_at ?? null;
  if ('exited_portal_at' in profile) out.exited_portal_at = profile.exited_portal_at ?? null;
  if ('portal_status' in profile && profile.portal_status !== undefined) out.portal_status = profile.portal_status;
  if ('destination_school' in profile) out.destination_school = profile.destination_school ?? null;
  if ('eligibility_remaining' in profile) out.eligibility_remaining = profile.eligibility_remaining ?? null;
  if ('reason_tags' in profile) out.reason_tags = profile.reason_tags ?? [];
  if ('portal_likelihood' in profile) out.portal_likelihood = profile.portal_likelihood ?? null;
  if ('likelihood_reason' in profile) out.likelihood_reason = profile.likelihood_reason ?? null;
  return out;
}
