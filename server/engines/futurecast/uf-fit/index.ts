/**
 * UF Fit Score System — public entry.
 * @see server/docs/futurecast-platform-spec.md §2.3
 */
import { computeUfFitForPlayer, computeUfFitBatch } from './compute-fit';

export interface UfFitRecomputeOptions {
  playerId?: string;
  dryRun?: boolean;
  classYear?: number;
  limit?: number;
}

export interface UfFitRecomputeResult {
  playersUpdated: number;
}

export async function runUfFitRecompute(opts: UfFitRecomputeOptions = {}): Promise<UfFitRecomputeResult> {
  if (opts.playerId) {
    await computeUfFitForPlayer(opts.playerId, { dryRun: opts.dryRun });
    return { playersUpdated: 1 };
  }
  return computeUfFitBatch({
    classYear: opts.classYear,
    dryRun: opts.dryRun,
    limit: opts.limit,
  });
}

export { computeUfFitForPlayer, computeUfFitBatch };
