'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { FutureCastEliteHomepage } from '@/components/futurecast/FutureCastEliteHomepage';

export default function VaultFutureCastPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="master" testId="vault-futurecast-page">
      <FutureCastEliteHomepage />
    </FutureCastElitePageShell>
  );
}
