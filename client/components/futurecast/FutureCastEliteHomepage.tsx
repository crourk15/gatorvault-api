'use client';

import React, { useCallback, useEffect, useState } from 'react';
import '@/lib/futurecast-page.css';
import { loadFutureCastPageData, type FutureCastPageData } from '@/lib/api/futurecast';
import { ApiFetchError } from '@/lib/api-fetch';
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
      if (initial) {
        const message =
          err instanceof ApiFetchError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load FutureCast.';
        setError(message);
      }
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
      {data.loadWarnings.length > 0 ? (
        <p className="fc-empty" role="status" data-testid="fc-load-warnings">
          {data.loadWarnings[0]}
        </p>
      ) : null}
      <FutureCastPageHero
        summary={data.summary}
        metrics={data.metrics}
        heatLevel={data.heatLevel}
        lastUpdated={data.highPriorityLastUpdated ?? data.summary.lastUpdated ?? null}
      />
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
