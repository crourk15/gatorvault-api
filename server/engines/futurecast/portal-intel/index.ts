/**
 * Portal Intelligence Layer — public entry.
 * @see server/docs/futurecast-platform-spec.md §2.2
 */
import { runPortalIntelPipeline } from './pipeline';

export interface PortalIntelOptions {
  dryRun?: boolean;
}

export interface PortalIntelResult {
  playersScored: number;
  tagsApplied: number;
  avgLikelihood: number;
}

export async function runPortalIntelligence(opts: PortalIntelOptions = {}): Promise<PortalIntelResult> {
  return runPortalIntelPipeline(opts);
}
