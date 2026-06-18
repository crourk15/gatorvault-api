'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStaffDashboard, type StaffDashboardResponse } from '@/lib/staff-api';
import {
  fetchCompetingDeltas,
  fetchMovementSummary,
  type CompetingDeltasResponse,
  type MovementSummary,
} from '@/lib/recruiting-movement-api';
import { fetchHomeMovementIntel, type HomeMovementIntelData } from '@/lib/vault-home-api';

const LAB_POLL_MS = 90_000;

export type FutureCastLabData = {
  staffDashboard: StaffDashboardResponse | null;
  movementSummary: MovementSummary | null;
  movementIntel: HomeMovementIntelData | null;
  competingDeltas: CompetingDeltasResponse | null;
  loading: boolean;
  refreshing: boolean;
};

export function useFutureCastLabData(): FutureCastLabData {
  const [staffDashboard, setStaffDashboard] = useState<StaffDashboardResponse | null>(null);
  const [movementSummary, setMovementSummary] = useState<MovementSummary | null>(null);
  const [movementIntel, setMovementIntel] = useState<HomeMovementIntelData | null>(null);
  const [competingDeltas, setCompetingDeltas] = useState<CompetingDeltasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    const results = await Promise.allSettled([
      fetchStaffDashboard(),
      fetchMovementSummary(),
      fetchHomeMovementIntel(!isInitial),
      fetchCompetingDeltas(),
    ]);

    const [rStaff, rSummary, rIntel, rDeltas] = results;

    if (rStaff.status === 'fulfilled') setStaffDashboard(rStaff.value);
    if (rSummary.status === 'fulfilled') setMovementSummary(rSummary.value);
    if (rIntel.status === 'fulfilled') setMovementIntel(rIntel.value);
    if (rDeltas.status === 'fulfilled') setCompetingDeltas(rDeltas.value);

    if (isInitial) setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, LAB_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  return {
    staffDashboard,
    movementSummary,
    movementIntel,
    competingDeltas,
    loading,
    refreshing,
  };
}
