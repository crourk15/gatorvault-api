import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';

export default function VaultLiveFeedLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers
        testId="vault-live-feed"
        className="gv-live-feed gv-live-ticker"
        label="Headlines · Beat Writers · Podcasts"
        extraClasses="gv-live-feed__tabs gv-live-feed__row gv-live-feed__row-time"
      />
      {children}
    </>
  );
}
