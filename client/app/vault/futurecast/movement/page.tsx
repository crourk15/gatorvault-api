'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { MovementIntelPageContent } from '@/components/futurecast/MovementIntelPageContent';

export default function VaultFutureCastMovementPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="movement" testId="vault-futurecast-movement">
      <MovementIntelPageContent />
    </FutureCastElitePageShell>
  );
}
