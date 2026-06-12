//
// FutureCast — Shared Enums Module
// Single source of truth for all enum values used across the platform.
//

// -----------------------------
// Player Status
// -----------------------------
export const PLAYER_STATUS = [
  'ACTIVE',
  'INACTIVE',
  'TRANSFERRED',
  'COMMITTED',
  'SIGNED',
] as const;

export type PlayerStatus = (typeof PLAYER_STATUS)[number];

// -----------------------------
// Player lifecycle (Postgres: futurecast.players.status CHECK)
// -----------------------------
export const PLAYER_LIFECYCLE = ['HS', 'COLLEGE', 'PORTAL'] as const;

export type PlayerLifecycleStatus = (typeof PLAYER_LIFECYCLE)[number];

// -----------------------------
// Portal Status (Postgres ENUM: futurecast.portal_status)
// -----------------------------
export const PORTAL_STATUS = [
  'IN_PORTAL',
  'COMMITTED',
  'WITHDRAWN',
  'TRANSFERRED',
] as const;

export type PortalStatus = (typeof PORTAL_STATUS)[number];

// -----------------------------
// UF Status (Postgres ENUM: futurecast.uf_status)
// -----------------------------
export const UF_STATUS = [
  'TARGET',
  'PRIORITY',
  'COMMITTED',
  'EVAL',
  'NOT_INTERESTED',
] as const;

export type UFStatus = (typeof UF_STATUS)[number];

// -----------------------------
// Discovery Signal Type (Postgres ENUM: futurecast.signal_type)
// -----------------------------
export const SIGNAL_TYPE = [
  'OFFER',
  'RANKING_JUMP',
  'CAMP_PERFORMANCE',
  'EVALUATION_NOTE',
  'SOCIAL_MOMENTUM',
  'PORTAL_ACTIVITY',
  'STAFF_FLAG',
  'OTHER',
] as const;

export type SignalType = (typeof SIGNAL_TYPE)[number];

// -----------------------------
// Positions (optional but recommended)
// -----------------------------
export const POSITIONS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'DL',
  'EDGE',
  'LB',
  'CB',
  'S',
  'ATH',
  'K',
  'P',
] as const;

export type Position = (typeof POSITIONS)[number];

// -----------------------------
// Class Year helper (not a DB enum)
// -----------------------------
export const CLASS_YEARS = [2025, 2026, 2027, 2028, 2029] as const;

export type ClassYear = (typeof CLASS_YEARS)[number];
