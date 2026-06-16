'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { TrendingBoardLayout } from '@/components/futurecast/TrendingBoardLayout';

export default function FutureCastTrendingPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="trending" testId="futurecast-trending">
      <TrendingBoardLayout />
    </FutureCastElitePageShell>
  );
}
