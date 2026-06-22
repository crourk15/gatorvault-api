'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroStrip } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { SigningDayTracker } from '@/components/recruiting-hub/elite/SigningDayTracker';
import { ClassCards } from '@/components/recruiting-hub/elite/ClassCards';
import { RecruitingClassOverview } from '@/components/recruiting-hub/elite/RecruitingClassOverview';
import { TopTargetsHeatIndex } from '@/components/recruiting-hub/elite/TopTargetsHeatIndex';
import { MovementIntelFeed } from '@/components/recruiting-hub/elite/MovementIntelFeed';
import { BattleBoard } from '@/components/recruiting-hub/elite/BattleBoard';
import { RecruitingFootprintMap } from '@/components/recruiting-hub/elite/footprint/RecruitingFootprintMap';
import { RecruitingBattlesMovement } from '@/components/recruiting-hub/elite/RecruitingBattlesMovement';
import { RecruitingPositionSnapshot } from '@/components/recruiting-hub/elite/RecruitingPositionSnapshot';
import { RecruitingHubBundleProvider } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { LazyHubSection } from '@/components/recruiting-hub/elite/LazyHubSection';
import { useRecruitingHubBundle } from '@/components/recruiting-hub/elite/useRecruitingHubBundle';

/** WOW Recruiting Hub Elite — War Room vertical layout. */
export function RecruitingHubElite(): React.ReactElement {
  const bundle = useRecruitingHubBundle();

  return (
    <RecruitingHubBundleProvider value={bundle}>
      <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
        <RecruitingHeroStrip />
        <SigningDayTracker />
        <ClassCards />
        <RecruitingClassOverview />
        <LazyHubSection testId="rh-lazy-heat-index">
          <TopTargetsHeatIndex />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-movement-feed">
          <MovementIntelFeed />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-battle-board">
          <BattleBoard />
        </LazyHubSection>
        <LazyHubSection minHeight={420} testId="rh-lazy-footprint">
          <RecruitingFootprintMap />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-battles-movement">
          <RecruitingBattlesMovement />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-position-snapshot">
          <RecruitingPositionSnapshot />
        </LazyHubSection>
      </div>
    </RecruitingHubBundleProvider>
  );
}
