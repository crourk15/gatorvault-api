/** Predictions feed — /futurecast/predictions */
import React, { useMemo, useState } from 'react';
import { PredictionsFeedGrid } from '../../../components/futurecast/PredictionsFeedGrid';
import type { PredictionStatus } from '../../../lib/predictions-api';
import '../../../lib/futurecast.css';

const POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];
const CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
const STATUSES: { value: PredictionStatus | ''; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'HIT', label: 'Hit' },
  { value: 'MISS', label: 'Miss' },
  { value: '', label: 'All' },
];

export default function PredictionsPage(): React.ReactElement {
  const [classYear, setClassYear] = useState(2026);
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState<PredictionStatus | ''>('ACTIVE');

  const query = useMemo(
    () => ({
      class_year: classYear,
      position: position || undefined,
      status: status || undefined,
      limit: 100,
    }),
    [classYear, position, status]
  );

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }} data-testid="predictions-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', color: '#fff', margin: 0 }}>
          FutureCast Picks
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Commitment predictions with confidence scores
        </p>
      </header>

      <div className="fc-big-board-toolbar">
        <label>
          Class
          <select value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
            {CLASS_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p || 'all'} value={p}>{p || 'All'}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as PredictionStatus | '')}>
            {STATUSES.map((s) => (
              <option key={s.value || 'all'} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <PredictionsFeedGrid query={query} />
    </div>
  );
}
