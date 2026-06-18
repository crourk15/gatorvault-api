'use client';

import { useEffect, useState } from 'react';
import { buildHomeMetricCards } from '@/components/home/command-center/home-command-data';
import type { HomeMetricCard } from '@/components/home/command-center/types';
import { loadFutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import {
  computeMomentumPct,
  fetchHomeMovementIntel,
  fetchHomeNilPulse,
  fetchMovementPreview,
  fetchRecruitingSnapshot,
} from '@/lib/vault-home-api';

export function useHomeMetrics(): HomeMetricCard[] | null {
  const [metrics, setMetrics] = useState<HomeMetricCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchRecruitingSnapshot(),
      fetchMovementPreview(),
      fetchHomeMovementIntel(),
      fetchHomeNilPulse(),
      loadFutureCastWidgetBundle({ predictionsLimit: 1 }),
    ])
      .then(([recruiting, movement, movementIntel, nilPulse, fc]) => {
        if (cancelled) return;
        const momentumPct = computeMomentumPct(
          movement?.heatmap ?? fc.bundle?.home?.heatmap ?? null,
          fc.bundle?.classData?.rankings?.classScore
        );
        setMetrics(
          buildHomeMetricCards({
            recruiting,
            movement,
            movementIntel,
            fcBundle: fc.bundle,
            momentumPct,
            movementDelta: movement?.topRisers?.[0]?.delta ?? null,
            nilPulse,
          })
        );
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return metrics;
}
