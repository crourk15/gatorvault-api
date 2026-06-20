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

/** WOW Recruiting Hub Elite — War Room vertical layout. */
export function RecruitingHubElite(): React.ReactElement {
  return (
    <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
      <RecruitingHeroStrip />
      <SigningDayTracker />
      <ClassCards />
      <RecruitingClassOverview />
      <TopTargetsHeatIndex />
      <MovementIntelFeed />
      <BattleBoard />
      <RecruitingFootprintMap />
      <RecruitingBattlesMovement />
      <RecruitingPositionSnapshot />
    </div>
  );
}
