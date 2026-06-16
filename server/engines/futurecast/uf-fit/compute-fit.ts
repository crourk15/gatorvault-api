/**
 * UF Fit Score computation.
 * @see server/docs/futurecast-platform-spec.md §2.3
 */
import { UF_FIT_WEIGHTS, type UfFitSubScores } from './weights';

export function computeCompositeScore(sub: UfFitSubScores): number {
  return Math.round(
    sub.scheme_fit_score * UF_FIT_WEIGHTS.scheme_fit +
      sub.positional_need_score * UF_FIT_WEIGHTS.positional_need +
      sub.athletic_profile_score * UF_FIT_WEIGHTS.athletic_profile +
      sub.geographic_ties_score * UF_FIT_WEIGHTS.geographic_ties +
      sub.timeline_fit_score * UF_FIT_WEIGHTS.timeline_fit +
      sub.culture_fit_score * UF_FIT_WEIGHTS.culture_fit +
      sub.recruiting_momentum_score * UF_FIT_WEIGHTS.recruiting_momentum
  );
}

export async function gatherSubScores(_playerId: string): Promise<UfFitSubScores> {
  // Phase 2 stub — return neutral sub-scores until War Room / roster need wiring is complete.
  return {
    scheme_fit_score: 50,
    positional_need_score: 50,
    athletic_profile_score: 50,
    geographic_ties_score: 50,
    timeline_fit_score: 50,
    culture_fit_score: 50,
    recruiting_momentum_score: 50
  };
}

export async function computeUfFitForPlayer(playerId: string): Promise<number> {
  const sub = await gatherSubScores(playerId);
  return computeCompositeScore(sub);
}

export async function computeUfFitBatch(): Promise<{ playersUpdated: number }> {
  // TODO(Phase 2): nightly sweep all active players
  return { playersUpdated: 0 };
}
