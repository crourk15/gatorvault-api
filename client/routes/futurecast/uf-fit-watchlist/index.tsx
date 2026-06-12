/** UF Fit Watchlist page — /futurecast/uf-fit-watchlist */
import React, { useMemo, useState } from 'react';
import { UfFitWatchlistGrid } from '../../../components/futurecast/UfFitWatchlistGrid';
import type { FitTier, UfFitWatchlistSort } from '../../../lib/uf-fit-api';
import '../../../lib/futurecast.css';

const POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];
const CLASS_YEARS = [2024, 2025, 2026, 2027, 2028];
const TIERS: { value: FitTier | ''; label: string }[] = [
  { value: '', label: 'All tiers' },
  { value: 'elite', label: 'Elite (85+)' },
  { value: 'strong', label: 'Strong (70–84)' },
  { value: 'moderate', label: 'Moderate (50–69)' },
  { value: 'low', label: 'Low (<50)' },
];
const SORTS: { value: UfFitWatchlistSort; label: string }[] = [
  { value: 'ufFitScore', label: 'UF Fit Score' },
  { value: 'fitDelta', label: 'Fit Delta' },
  { value: 'fitVolatility', label: 'Volatility' },
];

export default function UfFitWatchlistPage(): React.ReactElement {
  const [classYear, setClassYear] = useState(2026);
  const [position, setPosition] = useState('');
  const [tier, setTier] = useState<FitTier | ''>('');
  const [sort, setSort] = useState<UfFitWatchlistSort>('ufFitScore');
  const [minScore, setMinScore] = useState<number | ''>('');

  const query = useMemo(
    () => ({
      class_year: classYear,
      position: position || undefined,
      tier: tier || undefined,
      minScore: minScore === '' ? undefined : minScore,
      sort,
      limit: 100,
    }),
    [classYear, position, tier, sort, minScore]
  );

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }} data-testid="uf-fit-watchlist-page">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', color: '#fff', margin: 0 }}>
          UF Fit Watchlist
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Scheme · Culture · Positional need · Staff interest
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
          Tier
          <select value={tier} onChange={(e) => setTier(e.target.value as FitTier | '')}>
            {TIERS.map((t) => (
              <option key={t.value || 'all'} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as UfFitWatchlistSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          Min Score
          <select value={minScore} onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Any</option>
            <option value={50}>50+</option>
            <option value={70}>70+</option>
            <option value={85}>85+</option>
          </select>
        </label>
      </div>

      <UfFitWatchlistGrid query={query} />
    </div>
  );
}
