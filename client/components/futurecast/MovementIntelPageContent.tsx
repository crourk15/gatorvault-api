'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MovementIntelLayout } from '@/components/futurecast/MovementIntelLayout';
import { FutureCastSubPageLoading } from '@/components/futurecast/FutureCastSubPageLoading';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastMovementIntel } from '@/lib/futurecast-board-api';
import type { MovementIntelResponse } from '@/lib/futurecast-board-types';

const REFRESH_MS = 60_000;

export function MovementIntelPageContent(): React.ReactElement {
  const [data, setData] = useState<MovementIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      setData(await fetchFutureCastMovementIntel());
      setError(null);
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Failed to load movement intel.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await load(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (loading) return <FutureCastSubPageLoading testId="fc-movement-intel-loading" />;
  if (error) return <UiError message={error} />;
  if (!data) return <p className="rh-cc-empty">No movement intel.</p>;

  return <MovementIntelLayout data={data} />;
}
