import { snapshotLiveFetch } from './snapshot-fetch';

export type NilEliteBoardPlayer = {
  id: string;
  slug: string;
  name: string;
  position: string;
  classYear: number;
  school: string | null;
  stars: number | null;
  nationalRank: number | null;
  rating: number | null;
  ufRpmPct: number | null;
  delta7d: number | null;
  committedTo: string | null;
  status: string;
  nilEstimate: string | null;
  vaultEstimate?: string | null;
  nilSource?: 'on3' | 'vault_est' | null;
  nilDisplay?: string | null;
  headliner?: boolean;
};

export type NilElitePortalWatch = {
  id: string;
  slug: string | null;
  name: string;
  position: string;
  classYear?: number;
  portalLikelihood: number;
  depthChartRisk: number;
  volatility: number;
};

export type NilEliteRosterArrival = {
  id: string;
  slug: string | null;
  name: string;
  position: string;
  transferInfo: string;
  stars: number | null;
  nationalRank: number | null;
  nilValuation?: string | null;
};

export type NilEliteRosterEarner = {
  id: string;
  slug: string | null;
  name: string;
  position: string;
  classYear: number | null;
  stars: number | null;
  depthChartTier: string | null;
  nilValuation: string;
  nilSource: 'vault_est' | 'on3';
};

export type NilEliteMovementItem = {
  id: string;
  category: string;
  text: string;
  slug?: string | null;
};

export type NilEliteCollective = {
  id: string;
  school: string;
  collective: string | null;
  isUf?: boolean;
};

export type NilEliteMoney = {
  estimatedAnnualPoolM: number | null;
  poolLabel: string | null;
  avgDealK: number | null;
  topDealM: number | null;
  secRank: number | null;
  nationalRank: number | null;
  trend: string | null;
  trendPct: number | null;
  collective: string;
  sourceNote: string;
};

export type NilEliteLandscapeRow = {
  id: string;
  school: string;
  collective: string | null;
  secRank: number | null;
  nationalRank?: number | null;
  score?: number | null;
  estimatedAnnualPoolM: number | null;
  avgDealK?: number | null;
  topDealM?: number | null;
  trend?: string | null;
  trendPct?: number | null;
};

export type NilEliteLandscape = {
  asOf?: string | null;
  sourceNote: string;
  disclaimer: string;
  uf: {
    collective: string;
    secRank: number | null;
    nationalRank: number | null;
    estimatedAnnualPoolM: number | null;
    avgDealK?: number | null;
    topDealM?: number | null;
    trend?: string | null;
    trendPct?: number | null;
  } | null;
  sec: NilEliteLandscapeRow[];
};

export type NilEliteBundle = {
  ok?: boolean;
  generatedAt: string;
  classYear: number;
  hero: {
    collective: string;
    school: string;
    eyebrow: string;
    title: string;
    sub: string;
    poolLabel?: string | null;
    poolCaption?: string | null;
  };
  money?: NilEliteMoney;
  pulse: {
    commits: number;
    blueChipPct: number | null;
    avgRating: number | null;
    activeTargets: number;
    portalArrivals: number;
    portalWatch: number;
  };
  rosterEarners?: NilEliteRosterEarner[];
  marketBoard: {
    leaders: NilEliteBoardPlayer[];
    targets: NilEliteBoardPlayer[];
    movers: NilEliteBoardPlayer[];
    commits: NilEliteBoardPlayer[];
  };
  portal: {
    watchlist: NilElitePortalWatch[];
    watchlistError?: string | null;
    rosterArrivals: NilEliteRosterArrival[];
  };
  collectives: NilEliteCollective[];
  movement: NilEliteMovementItem[];
  landscape?: NilEliteLandscape;
  editorial?: {
    asOf?: string | null;
    disclaimer: string;
    uf: {
      collective: string;
      secRank: number | null;
      nationalRank: number | null;
      estimatedAnnualPoolM: number | null;
    } | null;
    sec: Array<{
      id: string;
      school: string;
      collective: string | null;
      secRank: number | null;
      estimatedAnnualPoolM: number | null;
    }>;
  };
};

export async function fetchNilEliteBundle(): Promise<NilEliteBundle> {
  return snapshotLiveFetch<NilEliteBundle>('/api/nil/elite');
}
