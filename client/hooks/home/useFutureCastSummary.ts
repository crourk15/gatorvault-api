'use client';

import { useEffect, useState } from 'react';
import { loadFutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import { computeMomentumPct, fetchMovementPreview } from '@/lib/vault-home-api';

export type FutureCastSummary = {
  commitLikelihood7d: number;
  activeBattles: number;
  volatilityIndex: number;
  battleHeat: string;
  battleHeatScore: number;
};

function battleHeatLabel(score: number): string {
  if (score >= 8) return 'Hot';
  if (score >= 5) return 'Warm';
  return 'Cool';
}

export function useFutureCastSummary(): FutureCastSummary | null {
  const [summary, setSummary] = useState<FutureCastSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [{ bundle }, movement] = await Promise.all([
          loadFutureCastWidgetBundle({ predictionsLimit: 6 }),
          fetchMovementPreview(),
        ]);
        if (cancelled || !bundle) return;

        const commitLikelihood7d = computeMomentumPct(
          movement?.heatmap ?? bundle.home?.heatmap ?? null,
          bundle.classData?.classImpactScore ?? bundle.classData?.rankings?.classScore
        );

        const activeBattles = (bundle.home?.topTargets ?? []).filter((p) => {
          const uf = p.ufProbability ?? 0;
          const pct = uf <= 1 ? uf * 100 : uf;
          return pct >= 34 && pct < 67;
        }).length;

        const volatilityIndex = Math.min(
          100,
          (movement?.highVolatility?.length ?? 0) * 8 + Math.round(commitLikelihood7d * 0.4)
        );

        const battleHeatScore = Math.min(10, activeBattles + 2);

        setSummary({
          commitLikelihood7d,
          activeBattles,
          volatilityIndex,
          battleHeat: battleHeatLabel(battleHeatScore),
          battleHeatScore: battleHeatScore * 10,
        });
      } catch {
        /* keep null */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return summary;
}
