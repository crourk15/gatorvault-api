'use client';

import { useEffect, useState } from 'react';
import { loadFutureCastWidgetBundle } from '@/lib/futurecast-home-api';
import { computeMomentumPct, fetchMovementPreview } from '@/lib/vault-home-api';
import {
  fetchHighPriorityTargets,
  type HighPriorityPlayer,
} from '@/lib/futurecast-high-priority-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';

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

/** Same top-10 GV avg the Lab hero meter uses — not heatmap momentum theater. */
function commitLikelihoodFromHighPriority(players: HighPriorityPlayer[]): number | null {
  const year = primaryRecruitingClassYear();
  const top = [...players]
    .filter((p) => isActiveUfTarget(p))
    .filter((p) => Number(p.classYear) === year)
    .filter((p) => {
      const uf =
        p.ufProbability ?? (p as { ufConfidence?: number | null }).ufConfidence;
      return uf != null && Number.isFinite(Number(uf)) && Number(uf) > 0;
    })
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
    .slice(0, 10);
  if (!top.length) return null;
  const sum = top.reduce((acc, p) => {
    const uf = Number(
      p.ufProbability ?? (p as { ufConfidence?: number | null }).ufConfidence ?? 0
    );
    return acc + uf;
  }, 0);
  return Math.round(sum / top.length);
}

export function useFutureCastSummary(): FutureCastSummary | null {
  const [summary, setSummary] = useState<FutureCastSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const year = primaryRecruitingClassYear();
        const [{ bundle }, movement, hp] = await Promise.all([
          loadFutureCastWidgetBundle({ predictionsLimit: 6 }),
          fetchMovementPreview(),
          fetchHighPriorityTargets(year).catch(() => null),
        ]);
        if (cancelled || !bundle) return;

        const fromHp = commitLikelihoodFromHighPriority(hp?.players ?? []);
        const commitLikelihood7d =
          fromHp ??
          computeMomentumPct(
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
