import React from 'react';
import { RecruitingHubHeroSsr } from '@/components/recruiting-hub/elite/RecruitingHubHeroSsr';
import { RecruitingHubCommandCenterClient } from '@/components/recruiting-hub/command-center/RecruitingHubCommandCenterClient';

/** Recruiting Hub command center — SSR hero + client elite sections. */
export function RecruitingHubCommandCenter(): React.ReactElement {
  return (
    <div className="rh-cc-page" data-testid="rh-command-center">
      <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
        <RecruitingHubHeroSsr />
        <RecruitingHubCommandCenterClient deferHero />
      </div>
    </div>
  );
}
