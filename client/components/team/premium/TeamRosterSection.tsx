'use client';

import React, { useMemo, useState } from 'react';
import { RosterFilters } from '@/components/team/RosterFilters';
import { RosterList, type RosterViewMode } from '@/components/team/RosterList';
import { TeamPremiumModule } from './TeamPremiumModule';
import { TeamRosterSkeleton } from './TeamPageSkeleton';
import { UiWarming } from '@/components/site/UiMessage';
import { rosterMatchesFilter, type RosterFilter } from '@/lib/team-hub-data';
import type { TeamPlayer } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';
import { ROSTER_FILTER_OPTIONS } from '@/lib/team-hub-data';

type Props = {
  roster: TeamPlayer[];
  filter: RosterFilter;
  onFilterChange: (filter: RosterFilter) => void;
  loading?: boolean;
  warming?: boolean;
};

function isStarter(p: TeamPlayer): boolean {
  return (p.tags ?? []).some((t) => t.toLowerCase() === 'starter');
}

export function TeamRosterSection({
  roster,
  filter,
  onFilterChange,
  loading,
  warming,
}: Props): React.ReactElement {
  const [viewMode, setViewMode] = useState<RosterViewMode>('starters');

  const starterCount = useMemo(() => roster.filter(isStarter).length, [roster]);

  const counts = useMemo(() => {
    const source = viewMode === 'starters' ? roster.filter(isStarter) : roster;
    const next: Partial<Record<RosterFilter, number>> = { All: source.length };
    for (const f of ROSTER_FILTER_OPTIONS) {
      if (f === 'All') continue;
      next[f] = source.filter((p) => rosterMatchesFilter(p.position, f, p.positionGroup)).length;
    }
    return next;
  }, [roster, viewMode]);

  const showingCount = counts[filter] ?? 0;

  return (
    <div className="team-premium-section" id="roster" data-section="roster">
      <TeamPremiumModule
        title={TEAM_COPY.roster.title}
        subtitle={TEAM_COPY.roster.subtitle}
        stamp={
          roster.length > 0
            ? `${roster.length} on roster · ${starterCount} starters`
            : loading
              ? 'Loading…'
              : '0 players'
        }
        className="team-roster-module"
      >
        {roster.length === 0 && loading ? (
          <div className="team-premium-loading" role="status" aria-live="polite" aria-busy="true">
            {warming ? <UiWarming hint="Loading roster and depth chart." /> : null}
            <TeamRosterSkeleton />
          </div>
        ) : (
          <>
            <div className="gv-team-roster-view" role="group" aria-label="Roster view">
              <button
                type="button"
                className={`gv-team-roster-view__btn${viewMode === 'starters' ? ' is-active' : ''}`}
                onClick={() => setViewMode('starters')}
              >
                Starters
              </button>
              <button
                type="button"
                className={`gv-team-roster-view__btn${viewMode === 'full' ? ' is-active' : ''}`}
                onClick={() => setViewMode('full')}
              >
                Full roster
              </button>
            </div>

            <div className="gv-team-roster-summary" aria-label="Roster snapshot">
              <div className="gv-team-roster-summary__cell">
                <span className="gv-team-roster-summary__value">{roster.length || '—'}</span>
                <span className="gv-team-roster-summary__label">On roster</span>
              </div>
              <div className="gv-team-roster-summary__cell">
                <span className="gv-team-roster-summary__value">{starterCount || '—'}</span>
                <span className="gv-team-roster-summary__label">Starters</span>
              </div>
              <div className="gv-team-roster-summary__cell">
                <span className="gv-team-roster-summary__value">{showingCount}</span>
                <span className="gv-team-roster-summary__label">
                  {viewMode === 'starters' ? 'Showing starters' : 'In this view'}
                </span>
              </div>
            </div>

            <RosterFilters active={filter} onChange={onFilterChange} counts={counts} />
            <RosterList players={roster} filter={filter} viewMode={viewMode} />
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
