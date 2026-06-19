'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { StaffNotesPageContent } from '@/components/futurecast/StaffNotesPageContent';

export default function VaultFutureCastStaffPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="staff" testId="vault-futurecast-staff-page">
      <StaffNotesPageContent />
    </FutureCastElitePageShell>
  );
}
