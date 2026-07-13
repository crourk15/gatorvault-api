'use client';

import React from 'react';
import { TeamPremiumModule } from './TeamPremiumModule';
import { SwampStandardBlock } from './SwampStandardBlock';
import { TEAM_COPY } from '@/lib/team-hub-types';

/** Lean identity — one culture block, no fake Swamp stats or pillar cards. */
export function TeamIdentityPremiumSection(): React.ReactElement {
  return (
    <div className="team-premium-section" id="team-identity" data-section="team-identity">
      <TeamPremiumModule title={TEAM_COPY.identity.title} subtitle="The Swamp Standard">
        <SwampStandardBlock />
      </TeamPremiumModule>
    </div>
  );
}
