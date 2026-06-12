/**
 * Portal Intelligence pipeline.
 * @see server/docs/futurecast-platform-spec.md §2.2
 */
import type { PortalIntelOptions, PortalIntelResult } from './index';
import { computeReasonTags } from './reason-tags';

export async function analyzeUsageVsTalent(_playerId: string): Promise<string[]> {
  // TODO(Phase 2): efficiency vs snap_pct — spec §2.2 step 1
  throw new Error('TODO: analyzeUsageVsTalent');
}

export async function analyzeDepthChartSqueeze(_playerId: string): Promise<string[]> {
  // TODO(Phase 2): depth_chart_history delta — spec §2.2 step 2
  throw new Error('TODO: analyzeDepthChartSqueeze');
}

export async function computePortalLikelihood(_tags: string[]): Promise<number> {
  // TODO(Phase 2): combine tags → 0–100 — spec §2.2 step 4
  void _tags;
  return 0;
}

export async function runPortalIntelPipeline(opts: PortalIntelOptions): Promise<PortalIntelResult> {
  void opts;
  void computeReasonTags;
  return { playersScored: 0, tagsApplied: 0, avgLikelihood: 0 };
}
