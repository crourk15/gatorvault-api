'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { FutureCastEliteHomepage } from '@/components/futurecast/FutureCastEliteHomepage';

/** FutureCast — full elite master board page. */
export default function FutureCastPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="master" testId="futurecast-page">
      <FutureCastEliteHomepage />
    </FutureCastElitePageShell>
  );
}
