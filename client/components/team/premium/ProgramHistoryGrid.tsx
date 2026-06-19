'use client';

import React from 'react';
import type { Era } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';
import { TeamPremiumModule } from './TeamPremiumModule';
import { ProgramEraCard } from './ProgramEraCard';

type Props = {
  eras: Era[];
  onSelectEra: (era: Era) => void;
};

export function ProgramHistoryGrid({ eras, onSelectEra }: Props): React.ReactElement {
  return (
    <div className="team-premium-section" id="program-history" data-section="program-history">
      <TeamPremiumModule title={TEAM_COPY.programHistory.title} subtitle="Five decades of Gator football excellence">
        <div className="team-era-grid">
          {eras.map((era) => (
            <ProgramEraCard key={era.id} era={era} onSelect={onSelectEra} />
          ))}
        </div>
      </TeamPremiumModule>
    </div>
  );
}
