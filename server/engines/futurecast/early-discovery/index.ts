/**
 * Early Discovery Engine — public entry.
 * @see server/docs/futurecast-platform-spec.md §2.1
 */
import { runEarlyDiscoveryPipeline } from './pipeline';

export interface EarlyDiscoveryOptions {
  classYearGte?: number;
  dryRun?: boolean;
}

export interface EarlyDiscoveryResult {
  playersProcessed: number;
  signalsCreated: number;
  watchlistPromotions: number;
  targetPromotions: number;
}

/** TODO(Phase 2): wire to opsMonitor.wrapJob('engine:early-discovery', ...) */
export async function runEarlyDiscovery(opts: EarlyDiscoveryOptions = {}): Promise<EarlyDiscoveryResult> {
  return runEarlyDiscoveryPipeline(opts);
}
