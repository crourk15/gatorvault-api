/**
 * Player profile predictions panel — active + historical FutureCast Picks.
 */
import React, { useEffect, useState } from 'react';
import {
  fetchPlayerPredictions,
  sourceTypeLabel,
  statusLabel,
  type PlayerPrediction,
  type PredictionStatus,
} from '../../../lib/predictions-api';

export interface PredictionsPanelProps {
  playerId: string;
}

export function PredictionsPanel({ playerId }: PredictionsPanelProps): React.ReactElement {
  const [predictions, setPredictions] = useState<PlayerPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlayerPredictions(playerId)
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
  }, [playerId]);

  if (loading) return <p className="fc-profile-muted">Loading predictions…</p>;
  if (error) return <p className="fc-profile-muted">{error}</p>;
  if (!predictions.length) {
    return <p className="fc-profile-muted">No FutureCast Picks on file yet.</p>;
  }

  return (
    <ul className="fc-prediction-list" data-testid="player-predictions-panel">
      {predictions.map((p) => (
        <li key={p.id} className="fc-prediction-item">
          <div>
            <span className="fc-prediction-item__school">{p.school}</span>
            <span className={`fc-pred-source fc-pred-source--${p.sourceType.toLowerCase()}`}>
              {sourceTypeLabel(p.sourceType)}
            </span>
            <span className={`fc-pred-status fc-pred-status--${p.status.toLowerCase()}`}>
              {statusLabel(p.status as PredictionStatus)}
            </span>
          </div>
          <div className="fc-prediction-item__bar-wrap">
            <div className="fc-prediction-item__bar" style={{ width: `${p.confidence}%` }} />
          </div>
          <span className="fc-prediction-item__score">{p.confidence}%</span>
        </li>
      ))}
    </ul>
  );
}
