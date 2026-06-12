/** Predictions tab — FutureCast Picks feed via /api/predictions */
import React, { useMemo, useState } from 'react';
import { PredictionsFeedGrid } from '../../../components/futurecast/PredictionsFeedGrid';

export interface PredictionsTabProps {
  classYear?: number;
}

export default function PredictionsTab({ classYear = 2026 }: PredictionsTabProps): React.ReactElement {
  const [position, setPosition] = useState('');

  const query = useMemo(
    () => ({
      class_year: classYear,
      position: position || undefined,
      status: 'ACTIVE' as const,
      limit: 100,
    }),
    [classYear, position]
  );

  return (
    <div data-testid="tab-predictions">
      <div className="fc-big-board-toolbar" style={{ marginBottom: '1rem' }}>
        <label>
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'].map((p) => (
              <option key={p || 'all'} value={p}>{p || 'All'}</option>
            ))}
          </select>
        </label>
        <a href="/futurecast/predictions" style={{ alignSelf: 'flex-end', color: '#fa4616', fontSize: '0.875rem' }}>
          Full feed →
        </a>
      </div>
      <PredictionsFeedGrid query={query} />
    </div>
  );
}
