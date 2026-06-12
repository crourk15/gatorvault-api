/**
 * Big Board engine constants — weights, clamps, position order.
 */
import type { SignalType } from '../../shared/enums';
import { POSITIONS } from '../../shared/enums';

export const SCORE_WEIGHTS = {
  signal: 0.4,
  portalLikelihood: 0.3,
  ufFit: 0.3,
} as const;

export const SIGNAL_TYPE_WEIGHTS: Record<SignalType, number> = {
  OFFER: 10,
  RANKING_JUMP: 15,
  CAMP_PERFORMANCE: 20,
  EVALUATION_NOTE: 10,
  SOCIAL_MOMENTUM: 5,
  PORTAL_ACTIVITY: 25,
  STAFF_FLAG: 30,
  OTHER: 5,
};

export const UF_FIT_COMPONENT_MAX = {
  scheme: 40,
  culture: 30,
  positionalNeed: 20,
  staffInterest: 10,
} as const;

export const UF_STATUS_INTEREST: Record<string, number> = {
  TARGET: 5,
  PRIORITY: 8,
  EVAL: 3,
  COMMITTED: 10,
  NOT_INTERESTED: 0,
};

export const POSITION_SORT_ORDER: Record<string, number> = Object.fromEntries(
  POSITIONS.map((p, i) => [p, i])
);

export const BIG_BOARD_SORTS = [
  'rank',
  'signals',
  'portalLikelihood',
  'ufFit',
  'name',
  'position',
] as const;

export type BigBoardSort = (typeof BIG_BOARD_SORTS)[number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function clamp100(value: number): number {
  return clamp(value, 0, 100);
}

export function normalizePercent(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1) return n / 100;
  return n;
}

export function extractDepthChartRank(
  depthHistory: unknown[] | null,
  stats: Record<string, unknown> | null
): number | null {
  const fromStats = stats?.depth_chart_rank ?? stats?.depthChartRank;
  if (fromStats != null && Number.isFinite(Number(fromStats))) {
    return Number(fromStats);
  }
  if (!depthHistory?.length) return null;
  const last = depthHistory[depthHistory.length - 1] as Record<string, unknown>;
  const rank = last?.rank ?? last?.depth ?? last?.position_rank;
  if (rank != null && Number.isFinite(Number(rank))) {
    return Number(rank);
  }
  return null;
}

export function extractSnapPercent(snaps: Record<string, unknown> | null): number | null {
  if (!snaps) return null;
  const raw =
    snaps.snap_pct ??
    snaps.snapPercent ??
    snaps.snap_percentage ??
    snaps.offense_pct ??
    snaps.total_pct;
  return normalizePercent(raw);
}

export function signalScoreFromTypes(types: SignalType[]): number {
  let total = 0;
  for (const type of types) {
    total += SIGNAL_TYPE_WEIGHTS[type] ?? SIGNAL_TYPE_WEIGHTS.OTHER;
  }
  return clamp100(total);
}

export function hasSignalType(types: SignalType[], type: SignalType): boolean {
  return types.includes(type);
}
