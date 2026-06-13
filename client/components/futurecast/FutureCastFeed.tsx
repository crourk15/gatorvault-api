/**
 * FutureCast predictions feed — filters, infinite scroll, 60s refresh.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { fetchPredictionsFeed, type FeedPrediction } from '../../lib/predictions-api';
import { PredictionCard, feedPredictionToCard } from '../PredictionCard';
import {
  DEFAULT_FUTURECAST_FILTERS,
  FutureCastFilters,
  type FutureCastFiltersState,
} from './FutureCastFilters';

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
  const [filters, setFilters] = useState<FutureCastFiltersState>(DEFAULT_FUTURECAST_FILTERS);
  const [predictions, setPredictions] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const onFiltersChange = useCallback((next: FutureCastFiltersState) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      try {
        const rows = await fetchPredictionsFeed({ limit, ...filters });
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
  }, [limit, refreshIntervalMs, filters]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIMIT));
  }, [hasMore, loading]);

  const sentinelRef = useInfiniteScroll(loadMore);

  return (
    <div data-testid="futurecast-feed">
      <FutureCastFilters onChange={onFiltersChange} />

      {loading && predictions.length === 0 && (
        <p className="fc-profile-empty">Loading FutureCast predictions…</p>
      )}

      {error && predictions.length === 0 && (
        <p className="fc-profile-error">{error}</p>
      )}

      {!loading && !error && predictions.length === 0 && (
        <p className="fc-profile-empty">No predictions match these filters.</p>
      )}

      {predictions.length > 0 && (
        <div className="fc-predictions-grid futurecast-grid">
          {predictions.map((p) => (
            <PredictionCard key={p.id} prediction={feedPredictionToCard(p)} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="fc-loading-sentinel fc-predictions-grid__sentinel">
              Loading more…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
