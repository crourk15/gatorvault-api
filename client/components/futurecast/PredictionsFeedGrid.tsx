/**
 * Predictions feed grid — FutureCast Picks from /api/predictions.
 */
import React, { useEffect, useState } from 'react';
import {
  fetchPredictionsFeed,
  sourceTypeLabel,
  statusLabel,
  type FeedPrediction,
  type PredictionsFeedQuery,
  type PredictionStatus,
} from '../../lib/predictions-api';

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
        <PredictionCard key={p.id} prediction={p} />
      ))}
    </div>
  );
}

function PredictionCard({ prediction: p }: { prediction: FeedPrediction }): React.ReactElement {
  return (
    <a
      className="fc-prediction-card"
      href={`/futurecast/player/${encodeURIComponent(p.playerSlug)}`}
      data-testid="prediction-card"
    >
      <div className="fc-prediction-card__head">
        <span className="fc-prediction-card__confidence">{p.confidence}%</span>
        <span className={`fc-pred-source fc-pred-source--${p.sourceType.toLowerCase()}`}>
          {sourceTypeLabel(p.sourceType)}
        </span>
      </div>
      <h3 className="fc-prediction-card__name">{p.fullName}</h3>
      <p className="fc-prediction-card__meta">
        {p.position} · {p.classYear}
      </p>
      <p className="fc-prediction-card__school">{p.school}</p>
      <div className="fc-prediction-item__bar-wrap">
        <div className="fc-prediction-item__bar" style={{ width: `${p.confidence}%` }} />
      </div>
      <span className={`fc-pred-status fc-pred-status--${p.status.toLowerCase()}`}>
        {statusLabel(p.status as PredictionStatus)}
      </span>
    </a>
  );
}
