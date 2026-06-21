'use client';

import { useEffect, useState } from 'react';
import { ApiFetchError } from '@/lib/api-fetch';

const POLL_MS = 3000;
const MAX_POLL_MS = 180_000;

/** Snapshot/live query with warm-up polling on 503 — keeps skeleton until data loads. */
export function useSnapshotQuery<T>(fetcher: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();

    async function runAttempt(): Promise<void> {
      if (cancelled) return;
      setLoading(true);
      setError(false);
      try {
        const result = await fetcher();
        if (cancelled) return;
        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const warming =
          err instanceof ApiFetchError &&
          (err.unavailable === true || err.status === 503 || err.timedOut === true);
        const elapsed = Date.now() - started;
        if (warming && elapsed < MAX_POLL_MS) {
          pollTimer = setTimeout(() => {
            void runAttempt();
          }, POLL_MS);
          return;
        }
        setError(true);
        setLoading(false);
      }
    }

    void runAttempt();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [fetcher]);

  return { data, loading, error };
}
