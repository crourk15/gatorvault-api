/**
 * FutureCast Players API — shared helpers.
 */
import type { Request, Response, NextFunction } from 'express';
import {
  PLAYER_LIFECYCLE,
  PORTAL_STATUS,
  POSITIONS,
  UF_STATUS,
} from '../../shared/enums';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SLUG_RE = /^[a-z0-9-]+$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function parseLimit(raw: unknown, fallback = 200, max = 500): number {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > max) {
    throw new Error(`limit must be between 1 and ${max}`);
  }
  return Math.floor(n);
}

export function parseOptionalInt(raw: unknown, field: string): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a number`);
  }
  return n;
}

export function parseEnum<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[]
): T | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parsePosition(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(POSITIONS as readonly string[]).includes(value)) {
    throw new Error(`position must be one of: ${POSITIONS.join(', ')}`);
  }
  return value;
}

export const parseLifecycle = (raw: unknown) => parseEnum(raw, 'lifecycle', PLAYER_LIFECYCLE);
export const parsePortalStatus = (raw: unknown) => parseEnum(raw, 'portal_status', PORTAL_STATUS);
export const parseUfStatus = (raw: unknown) => parseEnum(raw, 'uf_status', UF_STATUS);

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      out[snakeToCamel(key)] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[snakeToCamel(key)] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? toCamelCase(item as Record<string, unknown>)
          : item
      );
      continue;
    }
    if (typeof value === 'object') {
      out[snakeToCamel(key)] = toCamelCase(value as Record<string, unknown>);
      continue;
    }
    out[snakeToCamel(key)] = value;
  }
  return out;
}

export function serializePlayerSummary(row: Record<string, unknown>) {
  return toCamelCase(row);
}

export function serializePlayer(row: Record<string, unknown>) {
  return toCamelCase(row);
}

/** Full player row for profile header (camelCase). */
export function serializeFullPlayer(player: {
  id: string;
  full_name: string;
  slug: string;
  class_year: number;
  position: string;
  status: string;
  height?: number | null;
  weight?: number | null;
  hometown?: string | null;
  state?: string | null;
  high_school?: string | null;
  stars?: number | null;
  composite_rating?: number | null;
  ranking_national?: number | null;
  ranking_position?: number | null;
  ranking_state?: number | null;
  committed_to?: string | null;
}) {
  return serializePlayer({
    id: player.id,
    full_name: player.full_name,
    slug: player.slug,
    class_year: player.class_year,
    position: player.position,
    status: player.status,
    height: player.height ?? null,
    weight: player.weight ?? null,
    hometown: player.hometown ?? null,
    state: player.state ?? null,
    high_school: player.high_school ?? null,
    stars: player.stars ?? null,
    composite_rating: player.composite_rating ?? null,
    ranking_national: player.ranking_national ?? null,
    ranking_position: player.ranking_position ?? null,
    ranking_state: player.ranking_state ?? null,
    committed_to: player.committed_to ?? null,
  });
}

export function serializeProfile(row: Record<string, unknown> | null) {
  return row ? toCamelCase(row) : null;
}

export function serializeSignal(row: Record<string, unknown>) {
  return toCamelCase(row);
}

export function handleApiError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (/must be|required|invalid/i.test(message)) {
    sendError(res, 400, message);
    return;
  }
  console.error('[futurecast-players-api]', err);
  sendError(res, 500, 'Internal server error');
}
