'use client';

import { useEffect, useState } from 'react';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { fetchFutureCastMasterBoard } from '@/lib/futurecast-board-api';
import { fetchTeamHubBundle } from '@/lib/team-hub-api';
import { fetchNilDashboard } from '@/lib/nil-api';
import {
  fetchContentLatest,
  fetchHomeUpcomingGames,
  fetchMovementPreview,
  fetchRecruitingSnapshot,
  type ContentLatestResponse,
  type HomeGameCard,
  type HomeNilPulse,
  type RecruitingSnapshot,
} from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { computeHeroMetrics, computeSnapshotMetrics } from '@/components/team/premium/team-premium-metrics';
import type { TeamHubBundle } from '@/lib/team-hub-api';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

export type UfPremiumHomeData = {
  loading: boolean;
  recruiting: RecruitingSnapshot | null;
  board: RecruitingBoardResponse | null;
  movement: StaffDashboardResponse | null;
  futurecast: MasterBoardResponse | null;
  team: TeamHubBundle | null;
  teamMetrics: ReturnType<typeof computeSnapshotMetrics>;
  nil: HomeNilPulse | null;
  nilGrade: string;
  nilValuation: string;
  schedule: HomeGameCard | null;
  content: ContentLatestResponse | null;
};

const EMPTY: UfPremiumHomeData = {
  loading: true,
  recruiting: null,
  board: null,
  movement: null,
  futurecast: null,
  team: null,
  teamMetrics: computeSnapshotMetrics(),
  nil: null,
  nilGrade: '—',
  nilValuation: '—',
  schedule: null,
  content: null,
};

export function useUfPremiumHomeData(): UfPremiumHomeData {
  const [data, setData] = useState<UfPremiumHomeData>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchRecruitingSnapshot(),
      fetchRecruitingBoard(2027).catch(() => null),
      fetchMovementPreview(),
      fetchFutureCastMasterBoard().catch(() => null),
      fetchTeamHubBundle().catch(() => null),
      fetchNilDashboard().catch(() => null),
      fetchHomeUpcomingGames(),
      fetchContentLatest(),
    ])
      .then(([recruiting, board, movement, futurecast, team, nilDash, scheduleData, content]) => {
        if (cancelled) return;

        const standing = nilDash?.ufStanding ?? {};
        const nilPulse: HomeNilPulse = {
          secRank: standing.secRank ?? 0,
          estPool: standing.estimatedAnnualPoolM != null ? `$${standing.estimatedAnnualPoolM.toFixed(1)}M` : '—',
          movementLabel: standing.trend ?? 'Stable',
          movementDelta:
            standing.trendPct != null
              ? `${standing.trendPct >= 0 ? '+' : ''}${standing.trendPct}%`
              : '—',
          topEarner: standing.collective ?? 'Gators Collective',
          topEarnerNote:
            (nilDash?.recentEvents?.length ?? 0) > 0
              ? `${nilDash!.recentEvents!.length} recent NIL events`
              : 'Tracking collective activity',
        };

        setData({
          loading: false,
          recruiting,
          board,
          movement,
          futurecast,
          team,
          teamMetrics: computeSnapshotMetrics(),
          nil: nilPulse,
          nilGrade: computeSnapshotMetrics().find((m) => m.id === 'nil-comp')?.value ?? 'B+',
          nilValuation: nilPulse.estPool,
          schedule: scheduleData.games[0] ?? null,
          content,
        });
      })
      .catch(() => {
        if (!cancelled) setData({ ...EMPTY, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

export function teamScholarshipCount(team: TeamHubBundle | null): string {
  if (!team) return '—';
  return String(computeHeroMetrics(team).find((m) => m.id === 'scholarships')?.value ?? '—');
}
