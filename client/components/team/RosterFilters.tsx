'use client';

import React from 'react';
import { ROSTER_FILTER_OPTIONS, type RosterFilter } from '@/lib/team-hub-data';

type Props = {
  active: RosterFilter;
  onChange: (filter: RosterFilter) => void;
};

export function RosterFilters({ active, onChange }: Props): React.ReactElement {
  return (
    <div className="gv-team-roster-filters" role="tablist" aria-label="Roster position filters">
      {ROSTER_FILTER_OPTIONS.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={active === filter}
          className={`gv-team-roster-chip${active === filter ? ' is-active' : ''}`}
          onClick={() => onChange(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
