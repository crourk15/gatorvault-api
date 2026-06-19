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
  type?: string;
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
  peers?: NilProgramRow[];
  updatedAt?: string;
};

function normalizeNilEvent(raw: Record<string, unknown>): NilEvent {
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    title: String(raw.title ?? raw.headline ?? 'NIL update'),
    summary: typeof raw.summary === 'string' ? raw.summary : typeof raw.detail === 'string' ? raw.detail : undefined,
    impact: typeof raw.impact === 'string' ? raw.impact : undefined,
    date: typeof raw.date === 'string' ? raw.date : undefined,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    recruitingCorrelation:
      typeof raw.recruitingCorrelation === 'string' ? raw.recruitingCorrelation : undefined,
  };
}

function normalizeDashboard(raw: NilDashboard): NilDashboard {
  return {
    ...raw,
    recentEvents: (raw.recentEvents ?? []).map((ev) =>
      normalizeNilEvent(ev as unknown as Record<string, unknown>)
    ),
  };
}

export async function fetchNilDashboard(): Promise<NilDashboard> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/nil/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`NIL dashboard failed (${res.status})`);
  const data = (await res.json()) as { dashboard?: NilDashboard };
  return normalizeDashboard(data.dashboard ?? {});
}
