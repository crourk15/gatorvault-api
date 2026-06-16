import React from 'react';
import { VaultPillarSsrMarkers } from '@/components/vault/VaultPillarSsrMarkers';

export default function VaultScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <VaultPillarSsrMarkers
        testId="vault-schedule"
        className="gv-schedule-page gv-sched-page"
        label="Schedule · Tickets"
      />
      {children}
    </>
  );
}
