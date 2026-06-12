/** Portal Watchlist — dedicated page consuming /api/portal/watchlist */
import React, { useMemo, useState } from 'react';
import { PortalWatchlistGrid } from '../../../components/futurecast/PortalWatchlistGrid';
import type { PortalWatchlistSort } from '../../../lib/portal-api';
import '../../../lib/futurecast.css';

const POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH', 'K', 'P'];
const CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
const SORTS: { value: PortalWatchlistSort; label: string }[] = [
  { value: 'likelihood', label: 'Portal Likelihood' },
  { value: 'volatility', label: 'Volatility' },
  { value: 'depthChartRisk', label: 'Depth Chart Risk' },
];

export default function PortalWatchlistPage(): React.ReactElement {
  const [classYear, setClassYear] = useState(2026);
  const [position, setPosition] = useState('');
  const [sort, setSort] = useState<PortalWatchlistSort>('likelihood');
  const [likelihoodMin, setLikelihoodMin] = useState(0.25);

  const query = useMemo(
    () => ({
      class_year: classYear,
      position: position || undefined,
      sort,
      likelihood_min: likelihoodMin,
      limit: 100,
    }),
    [classYear, position, sort, likelihoodMin]
  );

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }} data-testid="portal-watchlist-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', color: '#fff', margin: 0 }}>
          Portal Watchlist
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Portal Intelligence Engine — likelihood, risk, volatility
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
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as PortalWatchlistSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          Min Likelihood
          <select value={likelihoodMin} onChange={(e) => setLikelihoodMin(Number(e.target.value))}>
            <option value={0}>All</option>
            <option value={0.25}>25%+</option>
            <option value={0.5}>50%+</option>
            <option value={0.75}>75%+</option>
          </select>
        </label>
      </div>

      <PortalWatchlistGrid query={query} />
    </div>
  );
}
