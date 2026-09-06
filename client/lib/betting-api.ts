import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

export type BettingGame = {
  id?: string;
  game?: string;
  opponent?: string;
  home?: string;
  away?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  kickoff?: string;
  venue?: string;
  spread?: { line?: string; uf?: number } | string | null;
  total?: number | string | null;
  moneyline?: { uf?: number; opp?: number } | null;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  clock?: string | null;
  period?: number | null;
  live?: boolean;
  completed?: boolean;
  scoreSource?: string;
  source?: string;
};

export type BettingFinal = {
  gameKey?: string;
  scheduleId?: string;
  opponent?: string;
  uf: number;
  opp: number;
  source?: string;
};

export type BettingLinesResponse = {
  ok?: boolean;
  liveOddsEnabled?: boolean;
  nextGame?: BettingGame;
  lastGame?: BettingGame;
  finals?: Record<string, BettingFinal>;
  schedule?: BettingGame[];
  sportsbooks?: { name: string; url: string }[];
};

export async function fetchBettingLines(): Promise<BettingLinesResponse> {
  return snapshotFirstFetch('/api/betting/lines', () =>
    snapshotLiveFetch<BettingLinesResponse>('/api/betting/lines')
  );
}
