/**
 * Big Board API helpers.
 */
import type { Request, Response, NextFunction } from 'express';
import type { PlayerLifecycleStatus } from '../../shared/enums';
import { POSITIONS } from '../../shared/enums';
import { normalizeLifecycleInput, portalDbStatuses } from '../../shared/lifecycle';
import { BIG_BOARD_SORTS, type BigBoardSort } from './utils';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
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

function parseEnum<T extends string>(raw: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parseLifecycle(raw: unknown): PlayerLifecycleStatus | undefined {
  const normalized = normalizeLifecycleInput(raw);
  if (!normalized) return undefined;
  if (normalized === 'HS') return 'HS';
  if (normalized === 'PORTAL') return 'PORTAL';
  throw new Error('lifecycle ROSTER is not available on /api/big-board — use /api/roster/players');
}

export function parsePosition(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  const value = String(raw).toUpperCase();
  if (!(POSITIONS as readonly string[]).includes(value)) {
    throw new Error(`position must be one of: ${POSITIONS.join(', ')}`);
  }
  return value;
}

export function parseSort(raw: unknown): BigBoardSort {
  if (raw == null || raw === '') return 'rank';
  const value = String(raw);
  if (!(BIG_BOARD_SORTS as readonly string[]).includes(value)) {
    throw new Error(`sort must be one of: ${BIG_BOARD_SORTS.join(', ')}`);
  }
  return value as BigBoardSort;
}

export function parseOrder(raw: unknown): 'asc' | 'desc' {
  if (raw == null || raw === '') return 'desc';
  const value = String(raw).toLowerCase();
  if (value !== 'asc' && value !== 'desc') {
    throw new Error('order must be asc or desc');
  }
  return value;
}

export function handleApiError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (/must be|required|invalid/i.test(message)) {
    sendError(res, 400, message);
    return;
  }
  console.error('[futurecast-big-board-api]', err);
  sendError(res, 500, 'Internal server error');
}
