/**
 * Recruiting board API — /api/recruiting/board
 */
import { apiFetch } from './api-fetch';

export type RecruitingBoardTier = 'TOP' | 'HIGH' | 'MEDIUM' | 'LOW' | 'EVAL';

export interface RecruitingBoardPlayer {
  slug: string;
  name: string;
  position?: string | null;
  pos?: string;
  classYear?: number;
  state?: string | null;
  stars?: number;
  rating?: number | null;
  school?: string | null;
  tier: RecruitingBoardTier;
  tierLabel?: string;
  ufProbability?: number | null;
  fitScore?: number | null;
  staffGrade?: string | null;
  status?: string;
  notes?: string | null;
  notePreview?: string | null;
  lifecycle?: string;
  isTarget?: boolean;
  isCommittedToUF?: boolean;
  /** Legacy fields */
  htWt?: string;
  natl?: number;
  natlRank?: number;
  skinny?: string;
  profileNote?: string;
  vaultGrade?: number;
  displayRating?: number;
  ufOvStatus?: string;
}

export interface RecruitingBoardTierSection {
  tier: RecruitingBoardTier;
  label: string;
  count: number;
  players: RecruitingBoardPlayer[];
}

export interface RecruitingBoardResponse {
  ok: boolean;
  classYear: number;
  lifecycle?: string;
  players?: RecruitingBoardPlayer[];
  tiers?: RecruitingBoardTierSection[];
  commits?: RecruitingBoardPlayer[];
  targets?: RecruitingBoardPlayer[];
  empty?: boolean;
  message?: string;
  rankings?: {
    nationalRank?: number;
    secRank?: number;
    classScore?: number;
  } | null;
}

export async function fetchRecruitingBoard(
  classYear = 2027,
  staffMode = false
): Promise<RecruitingBoardResponse> {
  const staff = staffMode ? '&mode=staff' : '';
  return apiFetch<RecruitingBoardResponse>(
    `/api/recruiting/board?class=${classYear}${staff}`
  );
}

export const TIER_ORDER: RecruitingBoardTier[] = ['TOP', 'HIGH', 'MEDIUM', 'LOW', 'EVAL'];

export const TIER_LABELS: Record<RecruitingBoardTier, string> = {
  TOP: 'Top Priorities',
  HIGH: 'High Interest',
  MEDIUM: 'Medium Interest',
  LOW: 'Low Interest',
  EVAL: 'Evaluation Needed',
};
