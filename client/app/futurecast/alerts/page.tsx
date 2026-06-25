'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { AlertsFeed } from '@/components/futurecast/AlertsFeed';

export default function FutureCastAlertsPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="master" testId="futurecast-alerts-page">
      <AlertsFeed showSubNav={false} />
    </FutureCastElitePageShell>
  );
}
