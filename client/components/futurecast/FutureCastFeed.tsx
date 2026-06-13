/**
 * FutureCast predictions feed — polls /api/predictions and renders PredictionCards.
 */
import React, { useEffect, useState } from 'react';
import { fetchPredictionsFeed, type FeedPrediction } from '../../lib/predictions-api';
import { PredictionCard, feedPredictionToCard } from '../PredictionCard';

export interface FutureCastFeedProps {
  limit?: number;
  /** Poll interval in ms; set to 0 to disable auto-refresh. Default 60s. */
  refreshIntervalMs?: number;
}

export function FutureCastFeed({
  limit = 50,
  refreshIntervalMs = 60_000,
}: FutureCastFeedProps): React.ReactElement {
  const [predictions, setPredictions] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
