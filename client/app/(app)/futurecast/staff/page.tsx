'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { StaffNotesPageContent } from '@/components/futurecast/StaffNotesPageContent';

export default function FutureCastStaffPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="staff" testId="futurecast-staff">
      <StaffNotesPageContent />
    </FutureCastElitePageShell>
  );
}
