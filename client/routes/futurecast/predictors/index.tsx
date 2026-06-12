/** Predictor leaderboard — /futurecast/predictors */
import React from 'react';
import { PredictorLeaderboardTable } from '../../../components/futurecast/PredictorLeaderboardTable';
import '../../../lib/futurecast.css';

export default function PredictorsPage(): React.ReactElement {
  return (
    <div style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }} data-testid="predictors-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', color: '#fff', margin: 0 }}>
          Predictor Leaderboard
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Hit rates across FutureCast predictors
        </p>
      </header>
      <PredictorLeaderboardTable />
    </div>
  );
}
