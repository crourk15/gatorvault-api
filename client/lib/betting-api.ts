import { getApiBase } from './big-board-api';

export type BettingGame = {
  id?: string;
  game?: string;
  home?: string;
  away?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  kickoff?: string;
  spread?: { line?: string } | string;
  total?: number | string;
  moneyline?: { uf?: number; opp?: number };
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type BettingLinesResponse = {
  ok?: boolean;
  liveOddsEnabled?: boolean;
  nextGame?: BettingGame;
  schedule?: BettingGame[];
  sportsbooks?: { name: string; url: string }[];
};

export async function fetchBettingLines(): Promise<BettingLinesResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/betting/lines`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Betting lines failed (${res.status})`);
  return (await res.json()) as BettingLinesResponse;
}
