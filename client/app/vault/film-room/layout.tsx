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
        label="Offensive Scheme Defensive Scheme Film Breakdown UF Press Conferences Highlights"
        extraClasses="gv-film-hub-grid gv-film-hub-card gv-film-lessons"
      />
      {children}
    </>
  );
}
