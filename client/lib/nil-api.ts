import { getApiBase } from './big-board-api';

export type NilProgramRow = {
  id: string;
  name: string;
  conference?: string;
  collective?: string;
  ranking?: { secRank?: number; nationalRank?: number; score?: number } | null;
  metrics?: {
    estimatedAnnualPoolM?: number;
    trend?: string;
    trendPct?: number;
  } | null;
};

export type NilEvent = {
  id?: string;
  title: string;
  summary?: string;
  impact?: string;
  date?: string;
  recruitingCorrelation?: string;
};

export type NilDashboard = {
  conference?: string;
  ufStanding?: {
    secRank?: number;
    nationalRank?: number;
    score?: number;
    estimatedAnnualPoolM?: number;
    trend?: string;
    trendPct?: number;
    collective?: string;
  } | null;
  secRankings?: NilProgramRow[];
  trendHistory?: { period: string; valueM?: number; trend?: string; trendPct?: number }[];
  positionImpact?: { position: string; count: number }[];
  recruitingCorrelation?: { positiveEvents?: number; totalEvents?: number; note?: string };
  recentEvents?: NilEvent[];
  updatedAt?: string;
};

export async function fetchNilDashboard(): Promise<NilDashboard> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/nil/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`NIL dashboard failed (${res.status})`);
  const data = (await res.json()) as { dashboard?: NilDashboard };
  return data.dashboard ?? {};
}
