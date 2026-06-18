import type { FutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type {
  HomeMovementIntelData,
  HomeNilPulse,
  RecruitingSnapshot,
} from '@/lib/vault-home-api';
import { computeMomentumPct, heatmapSparkPct } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import type { HomeMetricCard } from './types';

const DEFAULT_SPARK = [42, 48, 44, 52, 55, 58, 61];

function sparkFromPct(pct: number, delta = 0): number[] {
  const end = Math.max(0, Math.min(100, pct));
  const start = Math.max(0, Math.min(100, end - delta));
  return [start, start + delta * 0.2, start + delta * 0.45, start + delta * 0.7, end];
}

export function buildHomeMetricCards(input: {
  recruiting: RecruitingSnapshot | null;
  movement: StaffDashboardResponse | null;
  movementIntel: HomeMovementIntelData | null;
  fcBundle: FutureCastWidgetBundle | null;
  momentumPct: number;
  movementDelta: number | null;
  nilPulse: HomeNilPulse | null;
}): HomeMetricCard[] {
  const snap = input.recruiting;
  const risers = input.movementIntel?.risers?.length ?? input.movement?.topRisers?.length ?? 0;
  const fallers = input.movementIntel?.fallers?.length ?? input.movement?.topFallers?.length ?? 0;
  const volatile = input.movementIntel?.volatile?.length ?? input.movement?.highVolatility?.length ?? 0;
  const fcPulse = input.momentumPct;
  const blueChip =
    input.fcBundle?.classData?.rankings?.classScore != null
      ? Math.round(input.fcBundle.classData.rankings.classScore)
      : fcPulse;
  const portalStable = (snap?.portalActive ?? 0) <= 3;
  const nilDelta = input.nilPulse?.movementDelta ?? '+0';
  const heatBuckets =
    input.movement?.heatmap?.buckets ?? input.fcBundle?.home?.heatmap?.buckets ?? [];
  const cycleHeat = heatmapSparkPct(heatBuckets);
  const heatLabel =
    cycleHeat >= 65 ? 'Hot' : cycleHeat >= 45 ? 'Warm' : cycleHeat >= 30 ? 'Stable' : 'Cool';

  return [
    {
      id: 'rank',
      icon: '🏆',
      label: 'Class Rank',
      value: snap?.classRank != null ? `#${snap.classRank}` : '—',
      meta: '2027',
      href: `${SITE_ROUTES.recruiting}/board`,
      sparkline: sparkFromPct(blueChip, input.movementDelta ?? 0),
    },
    {
      id: 'bluechip',
      icon: '⭐',
      label: 'Blue Chip %',
      value: `${blueChip}%`,
      meta: `${snap?.commits ?? 0} commits`,
      tone: blueChip >= 75 ? 'up' : blueChip >= 55 ? 'neutral' : 'down',
      href: SITE_ROUTES.recruiting,
      sparkline: sparkFromPct(blueChip, 2),
    },
    {
      id: 'fcpulse',
      icon: '📈',
      label: 'FutureCast Pulse',
      value: `${fcPulse}%`,
      meta: 'Top targets',
      tone: fcPulse >= 60 ? 'up' : 'neutral',
      href: SITE_ROUTES.futurecast,
      sparkline: sparkFromPct(fcPulse, input.movementDelta ?? 0),
    },
    {
      id: 'movement',
      icon: '📊',
      label: 'Movement Intel',
      value: `${risers}↑ ${fallers}↓ ${volatile}⚡`,
      meta: '7d',
      href: `${SITE_ROUTES.recruiting}#movement`,
      sparkline: sparkFromPct(50 + risers * 3 - fallers * 2, risers - fallers),
    },
    {
      id: 'portal',
      icon: '🚪',
      label: 'Portal Pulse',
      value: portalStable ? 'Stable' : `${snap?.portalActive ?? 0} active`,
      meta: 'Watchlist',
      tone: portalStable ? 'neutral' : 'hot',
      href: `${SITE_ROUTES.recruiting}?tab=portal`,
      sparkline: DEFAULT_SPARK,
    },
    {
      id: 'nil',
      icon: '💰',
      label: 'NIL Trend',
      value: nilDelta.startsWith('+') || nilDelta.startsWith('-') ? nilDelta : `+${nilDelta}`,
      meta: 'Cycle',
      tone: 'up',
      href: SITE_ROUTES.nil,
      sparkline: sparkFromPct(58, 2),
    },
    {
      id: 'heat',
      icon: '🔥',
      label: 'Cycle Heat',
      value: heatLabel,
      meta: '2027',
      tone: heatLabel === 'Hot' ? 'hot' : heatLabel === 'Warm' ? 'warm' : 'neutral',
      href: SITE_ROUTES.futurecast,
      sparkline: sparkFromPct(cycleHeat, 4),
    },
  ];
}

export function computeFcPulseMetrics(fcBundle: FutureCastWidgetBundle | null, movement: StaffDashboardResponse | null) {
  const classScore = fcBundle?.classData?.classImpactScore ?? fcBundle?.classData?.rankings?.classScore;
  const commitLikelihood = computeMomentumPct(
    movement?.heatmap ?? fcBundle?.home?.heatmap ?? null,
    classScore
  );
  const players = fcBundle?.home?.topTargets ?? [];
  const activeBattles = players.filter((p) => {
    const uf = p.ufProbability ?? 0;
    const pct = uf <= 1 ? uf * 100 : uf;
    return pct >= 34 && pct < 67;
  }).length;
  const volatility = Math.min(
    100,
    (movement?.highVolatility?.length ?? 0) * 8 +
      Math.round(
        heatmapSparkPct(movement?.heatmap?.buckets ?? fcBundle?.home?.heatmap?.buckets ?? []) * 0.6
      )
  );
  return { commitLikelihood, activeBattles: Math.max(activeBattles, 0), volatility };
}
