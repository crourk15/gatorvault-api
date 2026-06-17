/**
 * Filter + dedupe FutureCast feed rows (2027 cycle, no enrolled Gators).
 */
import type { PredictionFeedRow, RollingMovement, StockBoardRow } from '../../models/predictions';
import {
  dedupeByPlayerId,
  FUTURECAST_CLASS_YEAR,
  isFutureCastEligible,
  isHsLifecycle,
  isMovementIntelEligible,
  isTopTargetRow,
  isTrendingEligibleRow,
  isUfCommitRow,
} from './eligibility';
import type { SerializedFeedPrediction } from '../predictions/utils-api';

export function filterFutureCastFeedRows<T extends PredictionFeedRow>(rows: T[]): T[] {
  return rows.filter((row) =>
    isHsLifecycle(row) &&
    isFutureCastEligible({
      class_year: row.class_year,
      lifecycle: row.lifecycle,
      committed_to: row.committed_to,
    })
  );
}

export function dedupeStockRows(rows: StockBoardRow[]): StockBoardRow[] {
  const best = new Map<string, StockBoardRow>();
  for (const row of rows) {
    const existing = best.get(row.player_id);
    if (!existing || Math.abs(row.window_delta) > Math.abs(existing.window_delta)) {
      best.set(row.player_id, row);
    }
  }
  return [...best.values()];
}

export function filterFutureCastStockRows(rows: StockBoardRow[]): StockBoardRow[] {
  return dedupeStockRows(filterFutureCastFeedRows(rows));
}

/** Movement Intel — 2027+ HS targets (excludes prior-cycle 2026 players). */
export function filterMovementIntelStockRows(rows: StockBoardRow[]): StockBoardRow[] {
  return dedupeStockRows(
    rows.filter((row) => isHsLifecycle(row) && isMovementIntelEligible({ class_year: row.class_year }))
  );
}

export function filterMovementIntelRollingRows(rows: RollingMovement[]): RollingMovement[] {
  const best = new Map<string, RollingMovement>();
  for (const row of rows) {
    if (!isMovementIntelEligible({ class_year: row.classYear })) continue;
    const existing = best.get(row.playerId);
    if (!existing || Math.abs(row.delta7d) > Math.abs(existing.delta7d)) {
      best.set(row.playerId, row);
    }
  }
  return [...best.values()];
}

export function filterTrendingStockRows(rows: StockBoardRow[]): StockBoardRow[] {
  return filterFutureCastStockRows(rows).filter((row) =>
    isTrendingEligibleRow({
      lifecycle: row.lifecycle,
      committed_to: row.committed_to,
      uf_status: row.uf_status,
    })
  );
}

export function filterModelPredictionsOnly<T extends PredictionFeedRow>(rows: T[]): T[] {
  return rows.filter((row) => String(row.source_type).toUpperCase() === 'MODEL');
}

export function dedupeFeedRows<T extends PredictionFeedRow>(rows: T[]): T[] {
  const mapped = rows.map((row) => ({
    ...row,
    playerId: row.player_id,
    confidence: row.confidence,
  }));
  return dedupeByPlayerId(mapped).map(({ playerId: _pid, ...rest }) => rest as T);
}

export function partitionHomepagePredictions(rows: SerializedFeedPrediction[]): {
  commits: SerializedFeedPrediction[];
  topTargets: SerializedFeedPrediction[];
} {
  const eligible = rows.filter((row) =>
    isFutureCastEligible({
      class_year: row.classYear,
      lifecycle: row.lifecycle,
      committed_to: row.committedTo,
    }) && isHsLifecycle(row)
  );

  const commits = eligible.filter((row) =>
    isUfCommitRow({
      lifecycle: row.lifecycle,
      committed_to: row.committedTo,
      uf_status: row.ufStatus,
    })
  );

  const topTargets = eligible.filter((row) =>
    isTopTargetRow({
      lifecycle: row.lifecycle,
      committed_to: row.committedTo,
      uf_status: row.ufStatus,
      school: row.school,
    })
  );

  return { commits, topTargets };
}

export { FUTURECAST_CLASS_YEAR, MOVEMENT_INTEL_MIN_CLASS_YEAR } from './eligibility';
