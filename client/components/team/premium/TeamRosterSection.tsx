'use client';

import React from 'react';
import { RosterFilters } from '@/components/team/RosterFilters';
import { RosterList } from '@/components/team/RosterList';
import { TeamPremiumModule } from './TeamPremiumModule';
import type { RosterFilter } from '@/lib/team-hub-data';
import type { TeamPlayer } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

type Props = {
  roster: TeamPlayer[];
  filter: RosterFilter;
  onFilterChange: (filter: RosterFilter) => void;
  loading?: boolean;
};

export function TeamRosterSection({ roster, filter, onFilterChange, loading }: Props): React.ReactElement {
  return (
    <div className="team-premium-section" id="roster" data-section="roster">
      <TeamPremiumModule
        title={TEAM_COPY.roster.title}
        subtitle={TEAM_COPY.roster.subtitle}
        stamp={loading ? 'Loading…' : `${roster.length} players`}
      >
        {loading && roster.length === 0 ? (
          <p className="team-premium-status">Loading roster…</p>
        ) : (
          <>
            <RosterFilters active={filter} onChange={onFilterChange} />
            <RosterList players={roster} filter={filter} />
          </>
        )}
      </TeamPremiumModule>
    </div>
  );
}
