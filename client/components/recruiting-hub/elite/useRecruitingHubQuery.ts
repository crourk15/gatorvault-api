'use client';

import { useEffect, useState } from 'react';

/** Hub query — single fast fetch, fail immediately on error. */
export function useRecruitingHubQuery<T>(fetcher: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setLoading(true);
      setError(false);
      try {
        const result = await fetcher();
        if (cancelled) return;
        setData(result);
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
  }, [fetcher]);

  return { data, loading, error };
}
