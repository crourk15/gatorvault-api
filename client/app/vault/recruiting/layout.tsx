import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';
import { RecruitingHubHeadLinks } from '@/components/recruiting-hub/elite/RecruitingHubHeadLinks';

export default function VaultRecruitingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <RecruitingHubHeadLinks />
      <VaultPillarSsrMarkers
        testId="vault-recruiting-hub"
        label="Recruiting Hub · 2026 Commits · Heat Check"
        extraClasses="gv-hub-tabs gv-hub-tabs--scroll gv-hub-tab"
      />
      {children}
    </>
  );
}
