'use client';

import { useEffect, useState } from 'react';

/** Lightweight query hook (SWR-style) without adding a dependency. */
export function useRecruitingHubQuery<T>(fetcher: () => Promise<T>): {
  data: T | null;
  loading: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        /* caller handles empty state */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return { data, loading };
}
