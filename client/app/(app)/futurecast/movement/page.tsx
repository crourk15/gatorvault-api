'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { MovementIntelLayout } from '@/components/futurecast/MovementIntelLayout';

export default function FutureCastMovementPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="movement" testId="futurecast-movement">
      <MovementIntelLayout />
    </FutureCastElitePageShell>
  );
}
