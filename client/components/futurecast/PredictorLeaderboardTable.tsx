/**
 * Predictor leaderboard table — /api/predictors/leaderboard.
 */
import React, { useEffect, useState } from 'react';
import { fetchPredictorLeaderboard, type PredictorLeaderboardEntry } from '../../lib/predictions-api';

export function PredictorLeaderboardTable(): React.ReactElement {
  const [predictors, setPredictors] = useState<PredictorLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPredictorLeaderboard()
      .then((rows) => {
        if (!cancelled) setPredictors(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="fc-profile-empty">Loading predictor stats…</p>;
  if (error) return <p className="fc-profile-error">{error}</p>;
  if (!predictors.length) {
    return <p className="fc-profile-empty">No predictor stats yet.</p>;
  }

  return (
    <table className="fc-leaderboard-table" data-testid="predictor-leaderboard">
      <thead>
        <tr>
          <th>Predictor</th>
          <th>Picks</th>
          <th>Hits</th>
          <th>Misses</th>
          <th>Hit Rate</th>
        </tr>
      </thead>
      <tbody>
        {predictors.map((p) => (
          <tr key={p.predictorId}>
            <td>{p.name}</td>
            <td>{p.picks}</td>
            <td>{p.hits}</td>
            <td>{p.misses}</td>
            <td>{p.hits + p.misses > 0 ? `${Math.round(p.hitRate * 100)}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
