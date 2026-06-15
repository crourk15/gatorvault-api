'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { TrendingBoardLayout } from '@/components/futurecast/TrendingBoardLayout';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastTrendingBoard } from '@/lib/futurecast-board-api';
import type { TrendingBoardResponse } from '@/lib/futurecast-board-types';

export function TrendingBoardPageContent(): React.ReactElement {
  const [data, setData] = useState<TrendingBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchFutureCastTrendingBoard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="fc-elite-loading">Loading trending board…</p>;
  if (error) return <UiError message={error} />;
  if (!data) return <p className="fc-elite-empty">No trending data.</p>;

  return (
    <TrendingBoardLayout
      trendingUp={data.trendingUp}
      trendingDown={data.trendingDown}
      updatedAt={data.updatedAt}
    />
  );
}
