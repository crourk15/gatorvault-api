/**
 * Recruiting board API — same-origin /api/recruiting/board
 */
import { apiFetch } from './api-fetch';

export interface RecruitingBoardPlayer {
  slug: string;
  name: string;
  pos?: string;
  position?: string;
  classYear?: number;
  stars?: number;
  rating?: number | string;
  school?: string;
  htWt?: string;
  natl?: number;
  natlRank?: number;
  posRk?: number;
  posRank?: number;
  stRk?: number;
  stateRank?: number;
  status?: string;
  committedTo?: string;
  category?: string;
  inState?: boolean;
}

export interface RecruitingBoardResponse {
  ok: boolean;
  classYear: number;
  commits: RecruitingBoardPlayer[];
  targets: RecruitingBoardPlayer[];
  rankings?: {
    nationalRank?: number;
    secRank?: number;
    classScore?: number;
  } | null;
}

export async function fetchRecruitingBoard(classYear = 2027): Promise<RecruitingBoardResponse> {
  return apiFetch<RecruitingBoardResponse>(`/api/recruiting/board?class=${classYear}`);
}
