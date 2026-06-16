'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { MasterBoardLayout } from '@/components/futurecast/MasterBoardLayout';

/** FutureCast — gauge hero, movement cards, sortable table. */
export default function FutureCastPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="master" testId="futurecast-page">
      <MasterBoardLayout />
    </FutureCastElitePageShell>
  );
}
