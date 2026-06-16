'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { MovementIntelPageContent } from '@/components/futurecast/MovementIntelPageContent';

export default function FutureCastMovementPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="movement" testId="futurecast-movement">
      <MovementIntelPageContent />
    </FutureCastElitePageShell>
  );
}
