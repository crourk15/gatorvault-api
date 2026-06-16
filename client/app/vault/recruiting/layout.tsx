import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';

export default function VaultRecruitingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers
        testId="vault-recruiting-hub"
        label="Recruiting Hub · 2026 Commits · Heat Check"
        extraClasses="gv-hub-tabs gv-hub-tabs--scroll gv-hub-tab"
      />
      {children}
    </>
  );
}
