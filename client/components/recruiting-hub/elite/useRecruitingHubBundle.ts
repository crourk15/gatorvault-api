'use client';

import { useEffect, useState } from 'react';
import {
  fetchRecruitingHubBundle,
  RECRUITING_HUB_ELITE_YEAR,
  type RhHubBundle,
} from '@/lib/recruiting-hub-elite-api';
import type { RecruitingHubBundleState } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';

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
        const bundle = await fetchRecruitingHubBundle(year);
        if (cancelled) return;
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
