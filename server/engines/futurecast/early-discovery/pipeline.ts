/**
 * Early Discovery pipeline — roster → signals → discovery_score → uf_status.
 * @see server/docs/futurecast-platform-spec.md §2.1
 */
import { createRequire } from 'node:module';
import type { EarlyDiscoveryOptions, EarlyDiscoveryResult } from './index';
import { createSignalFromEvent } from './signals';

const require = createRequire(import.meta.url);
const { runEarlyDiscoveryJob } = require('../../../lib/early-discovery-run.js');

export async function ingestRosters(_opts: EarlyDiscoveryOptions): Promise<number> {
  // TODO(Phase 2+): MaxPreps / public roster adapters — spec §2.1 step 1
  void _opts;
  return 0;
}

export async function aggregateDiscoveryScores(playerId: string): Promise<number> {
  void playerId;
  // Scores are batch-recomputed in runEarlyDiscoveryJob; per-player hook reserved for Phase 2+.
  return 0;
}

export async function applyUfRelevanceRules(_playerId: string): Promise<void> {
  // UF status promotions run inside runEarlyDiscoveryJob when discovery_score >= thresholds.
  void _playerId;
}

export async function runEarlyDiscoveryPipeline(opts: EarlyDiscoveryOptions): Promise<EarlyDiscoveryResult> {
  void createSignalFromEvent;
  const result = await runEarlyDiscoveryJob({
    classYearGte: opts.classYearGte ?? 2028,
    dryRun: opts.dryRun ?? false,
  });
  return {
    playersProcessed: result.playersProcessed,
    signalsCreated: result.signalsCreated,
    watchlistPromotions: result.watchlistPromotions,
    targetPromotions: result.targetPromotions,
  };
}
