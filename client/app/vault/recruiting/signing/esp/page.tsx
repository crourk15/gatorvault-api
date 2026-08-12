'use client';

import React, { Suspense } from 'react';
import { SigningDayPage } from '@/components/recruiting-hub/elite/SigningDayPage';

export default function VaultRecruitingSigningEspPage(): React.ReactElement {
  return (
    <Suspense fallback={<p className="gv-page-status">Loading signing board…</p>}>
      <SigningDayPage eventId="esp" />
    </Suspense>
  );
}
