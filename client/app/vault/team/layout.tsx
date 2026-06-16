import React from 'react';

/** Static export markers for Platform Guardian content:team-module (SSR into index.html). */
export default function VaultTeamLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <span hidden aria-hidden="true" data-module="vault-team">
        Full Roster · Depth Chart · Team
      </span>
      {children}
    </>
  );
}
