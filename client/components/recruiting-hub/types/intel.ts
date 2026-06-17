export type IntelHeatStatus = 'trending-up' | 'battle' | 'cooling';

export type IntelType =
  | 'Visit Intel'
  | 'RPM Movement'
  | 'Offer + Trend'
  | 'Flip Watch'
  | 'Portal Intel';

/** Card display + action routing (playerId powers FutureCast / More Intel links) */
export type IntelCardProps = {
  name: string;
  position: string;
  classYear: string;
  ufProbability: number;
  heatStatus: IntelHeatStatus;
  intelType: IntelType;
  intelText: string;
  timestamp: string;
  playerId: string;
};

export const HEAT_LABELS: Record<IntelHeatStatus, string> = {
  'trending-up': '🔥 Trending Up',
  battle: '⚠️ Battle',
  cooling: '❄️ Cooling',
};
