/**
 * FutureCast predictions feed — infinite scroll + 60s refresh.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { fetchPredictionsFeed, type FeedPrediction } from '../../lib/predictions-api';
import { PredictionCard, feedPredictionToCard } from '../PredictionCard';

const PAGE_SIZE = 20;
const MAX_LIMIT = 500;

export interface FutureCastFeedProps {
  /** Poll interval in ms; set to 0 to disable auto-refresh. Default 60s. */
  refreshIntervalMs?: number;
}

export function FutureCastFeed({
  refreshIntervalMs = 60_000,
}: FutureCastFeedProps): React.ReactElement {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [predictions, setPredictions] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      try {
        const rows = await fetchPredictionsFeed({ limit });
        if (!cancelled) {
          setPredictions(rows);
          setHasMore(rows.length >= limit && limit < MAX_LIMIT);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading predictions.');
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);

    if (refreshIntervalMs > 0) {
      timer = setInterval(() => void load(false), refreshIntervalMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [limit, refreshIntervalMs]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIMIT));
  }, [hasMore, loading]);

  const sentinelRef = useInfiniteScroll(loadMore);

  if (loading && predictions.length === 0) {
    return <p className="fc-profile-empty">Loading FutureCast predictions…</p>;
  }

  if (error && predictions.length === 0) {
    return <p className="fc-profile-error">{error}</p>;
  }

  if (!predictions.length) {
    return <p className="fc-profile-empty">No predictions yet.</p>;
  }

  return (
    <div className="fc-predictions-grid futurecast-grid" data-testid="futurecast-feed">
      {predictions.map((p) => (
        <PredictionCard key={p.id} prediction={feedPredictionToCard(p)} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="fc-loading-sentinel fc-predictions-grid__sentinel">
          Loading more…
        </div>
      )}
    </div>
  );
}
