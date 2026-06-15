'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MovementIntelLayout } from '@/components/futurecast/MovementIntelLayout';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastMovementIntel } from '@/lib/futurecast-board-api';
import type { MovementIntelResponse } from '@/lib/futurecast-board-types';

export function MovementIntelPageContent(): React.ReactElement {
  const [data, setData] = useState<MovementIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchFutureCastMovementIntel());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movement intel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="fc-elite-loading">Loading movement intel…</p>;
  if (error) return <UiError message={error} />;
  if (!data) return <p className="fc-elite-empty">No movement intel.</p>;

  return <MovementIntelLayout data={data} />;
}
