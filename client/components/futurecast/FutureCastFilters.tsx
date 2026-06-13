/**
 * FutureCast feed filter toggles — HS, Portal, Florida, Trending Up.
 */
import React, { useEffect, useState } from 'react';

export type FutureCastFiltersState = {
  hsOnly: boolean;
  portalOnly: boolean;
  floridaOnly: boolean;
  trendingUp: boolean;
};

export const DEFAULT_FUTURECAST_FILTERS: FutureCastFiltersState = {
  hsOnly: false,
  portalOnly: false,
  floridaOnly: false,
  trendingUp: false,
};

export interface FutureCastFiltersProps {
  onChange: (filters: FutureCastFiltersState) => void;
}

export function FutureCastFilters({ onChange }: FutureCastFiltersProps): React.ReactElement {
  const [filters, setFilters] = useState<FutureCastFiltersState>(DEFAULT_FUTURECAST_FILTERS);

  useEffect(() => {
    onChange(filters);
  }, [filters, onChange]);

  const toggle = (key: keyof FutureCastFiltersState) => {
    setFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="fc-futurecast-filters" data-testid="futurecast-filters">
      <button
        type="button"
        className={`fc-futurecast-filters__btn${filters.hsOnly ? ' is-active' : ''}`}
        onClick={() => toggle('hsOnly')}
      >
        HS Only
      </button>
      <button
        type="button"
        className={`fc-futurecast-filters__btn${filters.portalOnly ? ' is-active' : ''}`}
        onClick={() => toggle('portalOnly')}
      >
        Portal Only
      </button>
      <button
        type="button"
        className={`fc-futurecast-filters__btn${filters.floridaOnly ? ' is-active' : ''}`}
        onClick={() => toggle('floridaOnly')}
      >
        Florida Only
      </button>
      <button
        type="button"
        className={`fc-futurecast-filters__btn${filters.trendingUp ? ' is-active' : ''}`}
        onClick={() => toggle('trendingUp')}
      >
        Trending Up
      </button>
    </div>
  );
}
