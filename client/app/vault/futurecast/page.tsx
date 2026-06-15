'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { MasterBoardLayout } from '@/components/futurecast/MasterBoardLayout';

export default function VaultFutureCastPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="master" testId="vault-futurecast-page">
      <MasterBoardLayout />
    </FutureCastElitePageShell>
  );
}
