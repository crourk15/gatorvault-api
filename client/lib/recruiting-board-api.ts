/**
 * Recruiting board API — /api/recruiting/board
 */
import { apiFetch } from './api-fetch';
import { filterBlockedRecruits } from './recruiting-blocked-players';

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
  fromSchool?: string | null;
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
  /** Legacy / enriched fields */
  htWt?: string;
  natl?: number;
  natlRank?: number;
  posRank?: number;
  stateRank?: number;
  skinny?: string;
  profileNote?: string;
  vaultGrade?: number;
  displayRating?: number;
  ufOvStatus?: string;
  visitStart?: string | null;
  visitEnd?: string | null;
  nextVisitSchool?: string | null;
  committedTo?: string | null;
  headliner?: boolean;
  commitDate?: string | null;
  inState?: boolean;
  movementDirection?: 'up' | 'down' | 'flat';
  category?: string;
  portalStatus?: 'in' | 'target' | 'out' | string;
  predictionSchools?: { school: string; pct: number }[];
  strengths?: string[];
  weaknesses?: string[];
  evaluatorNotes?: string | null;
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
  const data = await apiFetch<RecruitingBoardResponse>(
    `/api/recruiting/board?class=${classYear}${staff}`
  );
  return sanitizeRecruitingBoard(data);
}

function sanitizeRecruitingBoard(data: RecruitingBoardResponse): RecruitingBoardResponse {
  const filterList = (list?: RecruitingBoardPlayer[]) => filterBlockedRecruits(list ?? []);
  const tiers = data.tiers?.map((tier) => {
    const players = filterList(tier.players);
    return { ...tier, players, count: players.length };
  });
  return {
    ...data,
    players: filterList(data.players),
    commits: filterList(data.commits),
    targets: filterList(data.targets),
    tiers,
  };
}

export const TIER_ORDER: RecruitingBoardTier[] = ['TOP', 'HIGH', 'MEDIUM', 'LOW', 'EVAL'];

export const TIER_LABELS: Record<RecruitingBoardTier, string> = {
  TOP: 'Top Priorities',
  HIGH: 'High Interest',
  MEDIUM: 'Medium Interest',
  LOW: 'Low Interest',
  EVAL: 'Evaluation Needed',
};
