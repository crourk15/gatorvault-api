'use client';

import { useEffect, useState } from 'react';
import {
  fetchRecruitingHubBundle,
  RECRUITING_HUB_ELITE_YEAR,
  type RhHubBundle,
} from '@/lib/recruiting-hub-elite-api';
import type { RecruitingHubBundleState } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';

declare global {
  interface Window {
    __GV_HUB__?: { bundleLoadMs: number; year: number; ok: boolean };
  }
}

/** Single /api/recruiting/hub/bundle fetch for the elite landing page. */
export function useRecruitingHubBundle(year = RECRUITING_HUB_ELITE_YEAR): RecruitingHubBundleState {
  const [data, setData] = useState<RhHubBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setLoading(true);
      setError(false);
      try {
        const t0 = performance.now();
        const bundle = await fetchRecruitingHubBundle(year);
        const bundleLoadMs = Math.round(performance.now() - t0);
        if (cancelled) return;
        if (typeof window !== 'undefined') {
          window.__GV_HUB__ = { bundleLoadMs, year, ok: true };
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[recruiting-hub] bundle loaded in ${bundleLoadMs}ms`);
        }
        setData(bundle);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [year]);

  return { data, loading, error };
}
