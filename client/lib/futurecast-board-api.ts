import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';
import type {
  MasterBoardResponse,
  MovementIntelResponse,
  StaffNotesResponse,
  TrendingBoardResponse,
} from './futurecast-board-types';

export async function fetchFutureCastMasterBoard(): Promise<MasterBoardResponse> {
  return snapshotFirstFetch('/api/futurecast/master-board', () =>
    snapshotLiveFetch<MasterBoardResponse>('/api/futurecast/master-board')
  );
}

export async function fetchFutureCastTrendingBoard(): Promise<TrendingBoardResponse> {
  return snapshotFirstFetch('/api/futurecast/trending', () =>
    snapshotLiveFetch<TrendingBoardResponse>('/api/futurecast/trending')
  );
}

export async function fetchFutureCastMovementIntel(
  year?: number
): Promise<MovementIntelResponse> {
  const path =
    year != null && Number.isFinite(year)
      ? `/api/futurecast/movement-intel?year=${year}`
      : '/api/futurecast/movement-intel';
  return snapshotFirstFetch(path, () => snapshotLiveFetch<MovementIntelResponse>(path));
}

export async function fetchFutureCastStaffNotesBoard(year = 2027): Promise<StaffNotesResponse> {
  const path = `/api/futurecast/staff-notes?year=${year}`;
  return snapshotFirstFetch(path, () => snapshotLiveFetch<StaffNotesResponse>(path));
}
