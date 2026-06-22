'use client';

import { useEffect, useState } from 'react';
import {
  fetchRecruitingHubBundle,
  RECRUITING_HUB_ELITE_YEAR,
  type RhHubBundle,
} from '@/lib/recruiting-hub-elite-api';
import type { RecruitingHubBundleState } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { initGvHydrate } from '@/lib/gv-hydrate';

declare global {
  interface Window {
    __GV_HUB__?: {
      start: number;
      year: number;
      ok: boolean;
      bundleLoadMs?: number;
      heroRenderMs?: number;
      hydrationMs?: number;
      bundleToHeroMs?: number;
      hydrationQueueMs?: Record<string, number>;
    };
    __GV_HYDRATE_TIMINGS__?: Record<string, number>;
  }
}

function initHubMonitor(year: number): number {
  if (typeof window === 'undefined') return 0;
  const start = window.__GV_HUB__?.start ?? performance.now();
  window.__GV_HUB__ = {
    ...window.__GV_HUB__,
    start,
    year,
    ok: false,
  };
  initGvHydrate();
  return start;
}

/** Single /api/recruiting/hub/bundle fetch for the elite landing page. */
export function useRecruitingHubBundle(year = RECRUITING_HUB_ELITE_YEAR): RecruitingHubBundleState {
  const [data, setData] = useState<RhHubBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = initHubMonitor(year);

    async function run(): Promise<void> {
      setLoading(true);
      setError(false);
      try {
        const t0 = performance.now();
        const bundle = await fetchRecruitingHubBundle(year);
        const bundleLoadMs = Math.round(performance.now() - t0);
        if (cancelled) return;
        if (typeof window !== 'undefined') {
          window.__GV_HUB__ = {
            ...window.__GV_HUB__,
            start,
            bundleLoadMs,
            year,
            ok: true,
            heroRenderMs: window.__GV_HUB__?.heroRenderMs,
            hydrationMs: window.__GV_HUB__?.hydrationMs,
            bundleToHeroMs: window.__GV_HUB__?.bundleToHeroMs,
            hydrationQueueMs: window.__GV_HYDRATE_TIMINGS__,
          };
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[recruiting-hub] bundle loaded in ${bundleLoadMs}ms`);
        }
        setData(bundle);
        setLoading(false);
      } catch {
        if (cancelled) return;
        if (typeof window !== 'undefined') {
          window.__GV_HUB__ = { ...window.__GV_HUB__, start, year, ok: false };
        }
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
