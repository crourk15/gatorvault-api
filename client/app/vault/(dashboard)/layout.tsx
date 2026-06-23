import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';
import { HomeWowBootScript } from '@/components/home/premium/HomeWowBootScript';

export default function VaultHomeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers testId="vault-home" className="gv-home" />
      {children}
      <HomeWowBootScript />
    </>
  );
}
