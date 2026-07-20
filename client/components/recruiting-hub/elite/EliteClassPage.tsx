'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { RecruitingClassYearProvider } from '@/components/recruiting-hub/elite/RecruitingClassYearProvider';
import { EliteCommitBoard } from '@/components/recruiting-hub/elite/EliteCommitBoard';

type Props = {
  year: number;
};

export function EliteClassPage({ year }: Props): React.ReactElement {
  return (
    <RecruitingClassYearProvider initialYear={year}>
      <div className="rh-page rh-page--elite mobile-app" data-testid={`vault-recruiting-${year}`}>
        <div className="rh-frame rh-elite-chrome">
          <RecruitingHeroStripInline />
          <p className="rh-elite-back-link">
            <a href="/vault/recruiting">← Recruiting</a>
          </p>
          <EliteCommitBoard year={year} />
        </div>
      </div>
    </RecruitingClassYearProvider>
  );
}
