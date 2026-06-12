/**
 * Early Discovery pipeline — roster → signals → discovery_score → uf_status.
 * @see server/docs/futurecast-platform-spec.md §2.1
 */
import type { EarlyDiscoveryOptions, EarlyDiscoveryResult } from './index';
import { createSignalFromEvent } from './signals';

export async function ingestRosters(_opts: EarlyDiscoveryOptions): Promise<number> {
  // TODO(Phase 2): MaxPreps / public roster adapters — spec §2.1 step 1
  throw new Error('TODO: ingestRosters');
}

export async function aggregateDiscoveryScores(_playerId: string): Promise<number> {
  // TODO(Phase 2): Σ score_impact with optional time decay — spec §2.1 step 3
  throw new Error('TODO: aggregateDiscoveryScores');
}

export async function applyUfRelevanceRules(_playerId: string): Promise<void> {
  // TODO(Phase 2): FL geo, position need → watchlist/target — spec §2.1 step 4
  throw new Error('TODO: applyUfRelevanceRules');
}

export async function runEarlyDiscoveryPipeline(opts: EarlyDiscoveryOptions): Promise<EarlyDiscoveryResult> {
  // TODO(Phase 2): orchestrate full pipeline
  void opts;
  void createSignalFromEvent;
  return {
    playersProcessed: 0,
    signalsCreated: 0,
    watchlistPromotions: 0,
    targetPromotions: 0
  };
}
