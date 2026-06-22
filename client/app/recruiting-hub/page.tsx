import React from 'react';
import { RecruitingHubHeadLinks } from '@/components/recruiting-hub/elite/RecruitingHubHeadLinks';
import { RecruitingHubPage } from '@/components/recruiting-hub/RecruitingHubPage';

export default function RecruitingHubRoute(): React.ReactElement {
  return (
    <>
      <RecruitingHubHeadLinks />
      <RecruitingHubPage />
    </>
  );
}
