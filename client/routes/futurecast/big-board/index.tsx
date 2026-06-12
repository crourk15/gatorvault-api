/**
 * FutureCast Big Board — production page (consumes GET /api/big-board).
 */
import React, { useMemo, useState } from 'react';
import type { BigBoardLifecycle, BigBoardQuery, BigBoardSort } from '../../lib/big-board-api';
import { BigBoardGrid } from '../../components/futurecast/BigBoardGrid';
import '../../lib/futurecast.css';

const POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH', 'K', 'P'];
const CLASS_YEARS = [2025, 2026, 2027, 2028, 2029];
const SORTS: { value: BigBoardSort; label: string }[] = [
  { value: 'rank', label: 'Rank (intelligence)' },
  { value: 'ufFit', label: 'UF Fit Score' },
  { value: 'portalLikelihood', label: 'Portal likelihood' },
  { value: 'signals', label: 'Signals' },
  { value: 'name', label: 'Name' },
  { value: 'position', label: 'Position' },
];

export type BigBoardTabId =
  | 'top-targets'
  | 'early-discovery'
  | 'portal-watchlist'
  | 'predictions'
  | 'movement-tracker';

const TABS: { id: BigBoardTabId | 'rank'; label: string; sort: BigBoardSort; lifecycle?: BigBoardLifecycle }[] = [
  { id: 'rank', label: 'Rankings', sort: 'rank' },
  { id: 'top-targets', label: 'Top Targets', sort: 'ufFit' },
  { id: 'early-discovery', label: 'Early Discovery', sort: 'signals', lifecycle: 'HS' },
  { id: 'portal-watchlist', label: 'Portal Watchlist', sort: 'portalLikelihood', lifecycle: 'PORTAL' },
  { id: 'predictions', label: 'Predictions', sort: 'ufFit' },
  { id: 'movement-tracker', label: 'Movement', sort: 'signals' },
];

export default function BigBoardPage(): React.ReactElement {
  const [classYear, setClassYear] = useState(2026);
  const [position, setPosition] = useState('');
  const [lifecycle, setLifecycle] = useState<BigBoardLifecycle | ''>('');
  const [sort, setSort] = useState<BigBoardSort>('rank');
  const [activeTab, setActiveTab] = useState<string>('rank');

  const query = useMemo<BigBoardQuery>(
    () => ({
      class_year: classYear,
      position: position || undefined,
      lifecycle: lifecycle || undefined,
      sort,
      order: sort === 'name' || sort === 'position' ? 'asc' : 'desc',
      limit: 200,
    }),
    [classYear, position, lifecycle, sort]
  );

  function selectTab(tab: (typeof TABS)[number]) {
    setActiveTab(tab.id);
    setSort(tab.sort);
    setLifecycle(tab.lifecycle ?? '');
  }

  return (
    <div data-testid="big-board-layout" style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.75rem',
            color: '#fff',
            margin: 0,
          }}
        >
          FutureCast Big Board
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Intelligence rankings powered by signals, portal likelihood, and UF Fit Score™
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(0,48,135,.4)',
          paddingBottom: '0.75rem',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab)}
            style={{
              background: activeTab === tab.id ? 'rgba(250,70,22,.15)' : 'transparent',
              border: activeTab === tab.id ? '1px solid #fa4616' : '1px solid transparent',
              color: activeTab === tab.id ? '#fa4616' : '#94a3b8',
              borderRadius: 9999,
              padding: '0.35rem 0.85rem',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="fc-big-board-toolbar">
        <label>
          Class
          <select value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
            {CLASS_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p || 'all'} value={p}>
                {p || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lifecycle
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as BigBoardLifecycle | '')}
          >
            <option value="">All</option>
            <option value="HS">HS</option>
            <option value="COLLEGE">College</option>
            <option value="PORTAL">Portal</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as BigBoardSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <BigBoardGrid
        query={query}
        onPlayerClick={(p) => {
          window.location.href = `/futurecast/player/${encodeURIComponent(p.slug)}`;
        }}
      />
    </div>
  );
}
