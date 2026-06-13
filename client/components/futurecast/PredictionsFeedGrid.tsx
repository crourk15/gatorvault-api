/**
 * Predictions feed grid — FutureCast Picks from /api/predictions.
 */
import React, { useEffect, useState } from 'react';
import {
  fetchPredictionsFeed,
  type FeedPrediction,
  type PredictionsFeedQuery,
} from '../../lib/predictions-api';
import { PredictionCard, feedPredictionToCard } from '../PredictionCard';

export interface PredictionsFeedGridProps {
  query: PredictionsFeedQuery;
}

export function PredictionsFeedGrid({ query }: PredictionsFeedGridProps): React.ReactElement {
  const [predictions, setPredictions] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPredictionsFeed({ ...query, refresh: true })
      .then((rows) => {
        if (!cancelled) setPredictions(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load predictions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query.class_year, query.position, query.status, query.limit]);

  if (loading) return <p className="fc-profile-empty">Loading FutureCast Picks…</p>;
  if (error) return <p className="fc-profile-error">{error}</p>;
  if (!predictions.length) {
    return <p className="fc-profile-empty">No predictions match these filters.</p>;
  }

  return (
    <div className="fc-predictions-grid" data-testid="predictions-feed-grid">
      {predictions.map((p) => (
        <PredictionCard key={p.id} prediction={feedPredictionToCard(p)} />
      ))}
    </div>
  );
}
