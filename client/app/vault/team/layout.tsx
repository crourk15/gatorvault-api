import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';

export default function VaultTeamLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers
        testId="vault-team"
        className="gv-team-page gv-team-roster"
        label="Full Roster · Depth Chart · Team"
        extraClasses="gv-hub-tabs gv-hub-tabs--scroll gv-hub-tab"
      />
      {children}
    </>
  );
}
