import { snapshotLiveFetch } from './snapshot-fetch';

export type GatorsLiveBoard = {
  opponent?: string;
  opponentShort?: string;
  ufScore?: number | null;
  oppScore?: number | null;
  status?: string;
  clock?: string | null;
  period?: number | null;
  possession?: string | null;
  live?: boolean;
  completed?: boolean;
  matchup?: string;
  detail?: string;
};

export type GatorsLiveResponse = {
  ok?: boolean;
  mode?: 'ready' | 'live-window';
  inWindow?: boolean;
  featured?: {
    id?: string;
    opp?: string;
    date?: string;
    kickoffIso?: string | null;
  } | null;
  board?: GatorsLiveBoard | null;
  error?: string;
  waiting?: boolean;
  source?: string | null;
};

export async function fetchGatorsLive(): Promise<GatorsLiveResponse> {
  return snapshotLiveFetch<GatorsLiveResponse>('/api/gators-live');
}
