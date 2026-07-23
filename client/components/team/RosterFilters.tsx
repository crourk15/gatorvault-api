'use client';

import React, { useEffect, useRef } from 'react';
import { ROSTER_FILTER_OPTIONS, type RosterFilter } from '@/lib/team-hub-data';

type Props = {
  active: RosterFilter;
  onChange: (filter: RosterFilter) => void;
  counts?: Partial<Record<RosterFilter, number>>;
};

export function RosterFilters({ active, onChange, counts }: Props): React.ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const activeChip = track.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!activeChip) return;
    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <div className="gv-team-roster-filters-rail" data-testid="roster-filters-rail">
      <div
        ref={trackRef}
        className="gv-team-roster-filters"
        role="tablist"
        aria-label="Roster by position"
      >
        {ROSTER_FILTER_OPTIONS.map((filter) => {
          const count = counts?.[filter];
          const label = filter === 'All' ? 'ALL' : filter;
          return (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={active === filter}
              className={`gv-team-roster-chip${active === filter ? ' is-active' : ''}${
                filter === 'All' ? ' gv-team-roster-chip--all' : ''
              }`}
              onClick={() => onChange(filter)}
            >
              <span className="gv-team-roster-chip__label">{label}</span>
              {typeof count === 'number' ? (
                <span className="gv-team-roster-chip__count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
