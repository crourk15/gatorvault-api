import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';

export default function VaultFilmRoomLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers
        testId="vault-film-room"
        className="gv-film-room"
        label="Film Breakdown Scheme School UF Press Conferences Highlights"
        extraClasses="gv-fr-hero gv-fr-rail gv-fr-grid gv-fr-card"
      />
      {children}
    </>
  );
}
