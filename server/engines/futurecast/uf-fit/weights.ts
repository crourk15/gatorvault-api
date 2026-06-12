/**
 * UF Fit Score weights — spec §2.3
 * @see server/docs/futurecast-platform-spec.md §2.3
 */

export interface UfFitSubScores {
  scheme_fit_score: number;
  positional_need_score: number;
  athletic_profile_score: number;
  geographic_ties_score: number;
  timeline_fit_score: number;
  culture_fit_score: number;
  recruiting_momentum_score: number;
}

export const UF_FIT_WEIGHTS = {
  scheme_fit: 0.25,
  positional_need: 0.2,
  athletic_profile: 0.15,
  geographic_ties: 0.1,
  timeline_fit: 0.1,
  culture_fit: 0.1,
  recruiting_momentum: 0.1
} as const;

export const EMPTY_SUB_SCORES: UfFitSubScores = {
  scheme_fit_score: 0,
  positional_need_score: 0,
  athletic_profile_score: 0,
  geographic_ties_score: 0,
  timeline_fit_score: 0,
  culture_fit_score: 0,
  recruiting_momentum_score: 0
};
