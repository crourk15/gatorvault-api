import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';

export type QuickStatItem = {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral' | 'hot' | 'cooling';
  href?: string;
};

export function buildDashboardQuickStats(
  snapshot: RecruitingSnapshot,
  momentumPct: number,
  movementDelta?: number | null
): QuickStatItem[] {
  const portalTone: QuickStatItem['tone'] =
    snapshot.portalActive >= 10 ? 'hot' : snapshot.portalActive >= 5 ? 'neutral' : 'cooling';
  const nilTone: QuickStatItem['tone'] =
    snapshot.nilSecRank != null && snapshot.nilSecRank <= 5 ? 'up' : 'neutral';
  const fcTone: QuickStatItem['tone'] =
    movementDelta != null ? (movementDelta >= 0 ? 'up' : 'down') : momentumPct >= 60 ? 'up' : 'neutral';

  return [
    {
      label: 'Class Rank',
      value: snapshot.classRank != null ? `#${snapshot.classRank}` : '—',
      href: `${SITE_ROUTES.recruiting}/board`,
    },
    {
      label: 'Blue Chip %',
      value: `${momentumPct}%`,
      tone: momentumPct >= 70 ? 'up' : momentumPct >= 50 ? 'neutral' : 'down',
      href: SITE_ROUTES.futurecast,
    },
    {
      label: 'Portal Movement',
      value: String(snapshot.portalActive),
      tone: portalTone,
      href: `${SITE_ROUTES.recruiting}/portal`,
    },
    {
      label: 'NIL Trend',
      value: snapshot.nilSecRank != null ? `#${snapshot.nilSecRank} SEC` : '—',
      tone: nilTone,
      href: SITE_ROUTES.nil,
    },
    {
      label: 'FutureCast Movement',
      value: movementDelta != null ? `${movementDelta >= 0 ? '+' : ''}${movementDelta}` : `${momentumPct}%`,
      tone: fcTone,
      href: `${SITE_ROUTES.futurecast}/movement`,
    },
  ];
}
