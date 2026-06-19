'use client';

import React from 'react';
import { TeamPremiumModule } from './TeamPremiumModule';
import { SwampStandardBlock } from './SwampStandardBlock';
import { ProgramPillarsGrid } from './ProgramPillarsGrid';
import { SwampAdvantageHighlight } from './SwampAdvantageHighlight';
import { TEAM_COPY } from '@/lib/team-hub-types';

export function TeamIdentityPremiumSection(): React.ReactElement {
  return (
    <div className="team-premium-section" id="team-identity" data-section="team-identity">
      <TeamPremiumModule title={TEAM_COPY.identity.title} subtitle="The Swamp Standard — culture, pillars, and home-field edge">
        <SwampStandardBlock />
        <ProgramPillarsGrid />
        <SwampAdvantageHighlight />
      </TeamPremiumModule>
    </div>
  );
}
