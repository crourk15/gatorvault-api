'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroStrip } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { RecruitingClassOverview } from '@/components/recruiting-hub/elite/RecruitingClassOverview';
import { RecruitingCommitBoard } from '@/components/recruiting-hub/elite/RecruitingCommitBoard';
import { RecruitingBattlesMovement } from '@/components/recruiting-hub/elite/RecruitingBattlesMovement';
import { RecruitingPositionSnapshot } from '@/components/recruiting-hub/elite/RecruitingPositionSnapshot';

/** WOW Recruiting Hub Elite — War Room vertical layout. */
export function RecruitingHubElite(): React.ReactElement {
  return (
    <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
      <RecruitingHeroStrip />
      <RecruitingClassOverview />
      <RecruitingCommitBoard />
      <RecruitingBattlesMovement />
      <RecruitingPositionSnapshot />
    </div>
  );
}
