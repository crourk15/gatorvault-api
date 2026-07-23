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
  classLabel?: string | null;
  jersey?: string | number | null;
  nilValuation: string;
  nilSource: 'vault_est' | 'on3' | 'sideline';
  nilSourceLabel?: string | null;
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
  rosterMarketM?: number | null;
  rosterMarketLabel?: string | null;
  schoolMarketM?: number | null;
  schoolMarketLabel?: string | null;
  footballMarketM?: number | null;
  footballMarketLabel?: string | null;
  eliteMarketM?: number | null;
  vsElitePct?: number | null;
  indexedMarketB?: number | null;
  benefitsCapM?: number | null;
  programsIndexed?: number | null;
  avgDealK: number | null;
  topDealM: number | null;
  topEarnerName?: string | null;
  topEarnerValue?: string | null;
  secRank: number | null;
  nationalRank: number | null;
  trend: string | null;
  trendPct: number | null;
  collective: string;
  sourceNote: string;
  bySport?: Array<{
    sport: string;
    valueM?: number;
    valueK?: number;
    sharePct: number;
  }> | null;
  attribution?: string | null;
  provider?: string | null;
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
  provider?: string | null;
  programsIndexed?: number | null;
  headline?: {
    indexedMarketB?: number;
    topProgram?: string;
    topProgramMarketM?: number;
    benefitsCapM?: number;
    benefitsCapNote?: string;
  } | null;
  nationalTop?: Array<{
    nationalRank: number;
    secRank?: number | null;
    school: string;
    conference: string;
    marketM: number;
    programId?: string | null;
  }>;
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
