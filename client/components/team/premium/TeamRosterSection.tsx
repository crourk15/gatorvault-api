'use client';

import React, { useMemo } from 'react';
import { RosterFilters } from '@/components/team/RosterFilters';
import { RosterList } from '@/components/team/RosterList';
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

export function TeamRosterSection({
  roster,
  filter,
  onFilterChange,
  loading,
  warming,
}: Props): React.ReactElement {
  const starterCount = useMemo(
    () => roster.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase() === 'starter')).length,
    [roster]
  );

  const counts = useMemo(() => {
    const next: Partial<Record<RosterFilter, number>> = {};
    for (const f of ROSTER_FILTER_OPTIONS) {
      next[f] = roster.filter((p) => rosterMatchesFilter(p.position, f, p.positionGroup)).length;
    }
    return next;
  }, [roster]);

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
                <span className="gv-team-roster-summary__value">{counts[filter] ?? 0}</span>
                <span className="gv-team-roster-summary__label">
                  {filter === 'All' ? 'Full directory' : `${filter} room`}
                </span>
              </div>
            </div>
            <p className="gv-team-roster-guide">
              Browse QB → ST one room at a time. <strong>All</strong> (last) opens the full roster.
            </p>
            <RosterFilters active={filter} onChange={onFilterChange} counts={counts} />
            <RosterList players={roster} filter={filter} />
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
