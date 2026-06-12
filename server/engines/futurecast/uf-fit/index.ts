/**
 * UF Fit Score System — public entry.
 * @see server/docs/futurecast-platform-spec.md §2.3
 */
import { computeUfFitForPlayer, computeUfFitBatch } from './compute-fit';

export interface UfFitRecomputeOptions {
  playerId?: string;
  dryRun?: boolean;
}

export interface UfFitRecomputeResult {
  playersUpdated: number;
}

export async function runUfFitRecompute(opts: UfFitRecomputeOptions = {}): Promise<UfFitRecomputeResult> {
  if (opts.playerId) {
    await computeUfFitForPlayer(opts.playerId);
    return { playersUpdated: 1 };
  }
  return computeUfFitBatch();
}

export { computeUfFitForPlayer, computeUfFitBatch };
