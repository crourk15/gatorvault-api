'use client';

import React from 'react';

export type TrendingFilterState = {
  position: string;
  state: string;
  minRating: number;
  movementThreshold: number;
};

type Props = {
  filters: TrendingFilterState;
  onChange: (next: TrendingFilterState) => void;
  positions: string[];
  states: string[];
};

export function TrendingFilters({ filters, onChange, positions, states }: Props): React.ReactElement {
  return (
    <div className="fc-trending-filters" role="toolbar" aria-label="Trending filters">
      <label className="fc-trending-filters__field">
        Position
        <select
          value={filters.position}
          onChange={(e) => onChange({ ...filters, position: e.target.value })}
        >
          <option value="">All</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="fc-trending-filters__field">
        State
        <select
          value={filters.state}
          onChange={(e) => onChange({ ...filters, state: e.target.value })}
        >
          <option value="">All</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="fc-trending-filters__field">
        Min rating
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={filters.minRating || ''}
          onChange={(e) =>
            onChange({ ...filters, minRating: parseFloat(e.target.value) || 0 })
          }
        />
      </label>
      <label className="fc-trending-filters__field">
        Movement ≥
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={filters.movementThreshold || ''}
          onChange={(e) =>
            onChange({ ...filters, movementThreshold: parseFloat(e.target.value) || 0 })
          }
        />
      </label>
    </div>
  );
}

export function applyTrendingFilters<T extends { position: string; state?: string | null; composite: number; trendDelta7d: number }>(
  list: T[],
  filters: TrendingFilterState
): T[] {
  return list.filter((p) => {
    if (filters.position && p.position !== filters.position) return false;
    if (filters.state && p.state !== filters.state) return false;
    if (filters.minRating > 0 && p.composite < filters.minRating) return false;
    if (filters.movementThreshold > 0 && Math.abs(p.trendDelta7d) < filters.movementThreshold) {
      return false;
    }
    return true;
  });
}
