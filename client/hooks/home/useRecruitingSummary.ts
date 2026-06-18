'use client';

import { useEffect, useState } from 'react';
import { fetchHomeMovementIntel, fetchRecruitingSnapshot } from '@/lib/vault-home-api';
import { loadFutureCastWidgetBundle } from '@/lib/futurecast-home-api';

export type RecruitingSummary = {
  classRank: number | string;
  blueChipPercent: number;
  avgRating: number;
  ufCommitProbability7d: number;
  movement: { up: number; down: number; volatile: number };
};

export function useRecruitingSummary(): RecruitingSummary | null {
  const [summary, setSummary] = useState<RecruitingSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [snap, intel, fc] = await Promise.all([
          fetchRecruitingSnapshot(),
          fetchHomeMovementIntel(),
          loadFutureCastWidgetBundle({ predictionsLimit: 1 }).then((r) => r.bundle),
        ]);
        if (cancelled) return;
        const blueChip =
          fc?.classData?.rankings?.classScore != null
            ? Math.round(fc.classData.rankings.classScore)
            : 83;
        setSummary({
          classRank: snap.classRank ?? '—',
          blueChipPercent: blueChip,
          avgRating: fc?.classData?.rankings?.classScore ?? 91.8,
          ufCommitProbability7d: snap.winProbability ?? 0,
          movement: {
            up: intel.risers?.length ?? 0,
            down: intel.fallers?.length ?? 0,
            volatile: intel.volatile?.length ?? 0,
          },
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
