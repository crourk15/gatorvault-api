/**
 * Portal reason tag rules.
 * @see server/docs/futurecast-platform-spec.md §1.4 reason_tags
 */
export type ReasonTag =
  | 'buried_depth_chart'
  | 'scheme_mismatch'
  | 'coach_change'
  | 'usage_vs_talent'
  | 'grad_transfer_window'
  | 'nil_opportunity';

export interface TagContext {
  playerId: string;
  snapPct?: number;
  efficiencyPercentile?: number;
  depthChartDropSpots?: number;
  coachingChange?: boolean;
  schemeChange?: boolean;
}

export function computeReasonTags(ctx: TagContext): ReasonTag[] {
  // TODO(Phase 2): implement tag rules — spec §2.2 steps 1–3
  void ctx;
  return [];
}
