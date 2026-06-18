import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { FutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type {
  HomeBoardPreview,
  HomeGnlItem,
  HomeMovementIntelData,
  HomeNilPulse,
  PersonalizedResponse,
  RecruitingSnapshot,
  TickerResponse,
} from '@/lib/vault-home-api';

export type HomeMetricCard = {
  id: string;
  icon: string;
  label: string;
  value: string;
  href?: string;
  tone?: 'up' | 'down' | 'neutral' | 'hot' | 'warm' | 'cool';
  sparkline?: number[];
};

export type HomeCommandCenterProps = {
  loading: boolean;
  ticker: TickerResponse | null;
  recruiting: RecruitingSnapshot | null;
  movement: StaffDashboardResponse | null;
  movementIntel: HomeMovementIntelData | null;
  fcBundle: FutureCastWidgetBundle | null;
  momentumPct: number;
  movementDelta: number | null;
  nilPulse: HomeNilPulse | null;
  intelItems: HighPriorityIntelItem[];
  boards: HomeBoardPreview[];
  personalized: PersonalizedResponse | null;
  gnlItems: HomeGnlItem[];
  classYear?: number;
};
