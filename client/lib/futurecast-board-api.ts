import { apiFetch } from './api-fetch';
import type {
  MasterBoardResponse,
  MovementIntelResponse,
  StaffNotesResponse,
  TrendingBoardResponse,
} from './futurecast-board-types';

export async function fetchFutureCastMasterBoard(): Promise<MasterBoardResponse> {
  return apiFetch<MasterBoardResponse>('/api/futurecast/master-board');
}

export async function fetchFutureCastTrendingBoard(): Promise<TrendingBoardResponse> {
  return apiFetch<TrendingBoardResponse>('/api/futurecast/trending');
}

export async function fetchFutureCastMovementIntel(): Promise<MovementIntelResponse> {
  return apiFetch<MovementIntelResponse>('/api/futurecast/movement-intel');
}

export async function fetchFutureCastStaffNotesBoard(year = 2027): Promise<StaffNotesResponse> {
  return apiFetch<StaffNotesResponse>(`/api/futurecast/staff-notes?year=${year}`);
}
