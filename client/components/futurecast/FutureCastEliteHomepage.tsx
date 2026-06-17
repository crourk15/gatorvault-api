'use client';

import React, { useCallback, useEffect, useState } from 'react';
import '@/lib/futurecast-page.css';
import { loadFutureCastPageData, type FutureCastPageData } from '@/lib/api/futurecast';
import { UiError } from '@/components/site/UiMessage';
import { FutureCastPageLayout } from './FutureCastPageLayout';
import { FutureCastPageHero } from './FutureCastPageHero';
import { FutureCastMasterBoard } from './FutureCastMasterBoard';
import { FutureCastMovementHeatmap } from './FutureCastMovementHeatmap';
import { FutureCastHighPriorityStrip } from './FutureCastHighPriorityStrip';
import { FutureCastPortalWatchlist } from './FutureCastPortalWatchlist';
import { FutureCastStockBoard } from './FutureCastStockBoard';

const REFRESH_MS = 60_000;

export function FutureCastEliteHomepage(): React.ReactElement {
  const [data, setData] = useState<FutureCastPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await loadFutureCastPageData();
      setData(next);
      setError(null);
    } catch (err) {
      if (initial) setError(err instanceof Error ? err.message : 'Failed to load FutureCast.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (loading && !data) {
    return <p className="fc-elite-loading">Loading FutureCast…</p>;
  }
  if (error && !data) {
    return <UiError message={error} />;
  }
  if (!data) {
    return <p className="fc-elite-empty">No FutureCast data available.</p>;
  }

  return (
    <FutureCastPageLayout>
      <FutureCastPageHero summary={data.summary} metrics={data.metrics} heatLevel={data.heatLevel} />
      <FutureCastMasterBoard
        commits={data.home.commits ?? []}
        targets={data.targets}
        predictions={data.predictions}
      />
      <FutureCastMovementHeatmap snapshots={data.snapshots} stock={data.stock} />
      <FutureCastHighPriorityStrip players={data.highPriority} />
      <FutureCastPortalWatchlist portalPlayers={data.home.portalWatchlist ?? []} />
      <FutureCastStockBoard stock={data.stock} />
    </FutureCastPageLayout>
  );
}
