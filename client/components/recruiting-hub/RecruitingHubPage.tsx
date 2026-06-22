import React from 'react';
import { RecruitingHubPageChrome } from '@/components/recruiting-hub/RecruitingHubPageChrome';
import { RecruitingHubCommandCenter } from '@/components/recruiting-hub/command-center/RecruitingHubCommandCenter';

export function RecruitingHubPage(): React.ReactElement {
  return (
    <RecruitingHubPageChrome>
      <RecruitingHubCommandCenter />
    </RecruitingHubPageChrome>
  );
}
