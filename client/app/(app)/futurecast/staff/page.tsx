'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { StaffNotesLayout } from '@/components/futurecast/StaffNotesLayout';

export default function FutureCastStaffPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="staff" testId="futurecast-staff">
      <StaffNotesLayout />
    </FutureCastElitePageShell>
  );
}
