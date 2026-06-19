'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { TrendingBoardPageContent } from '@/components/futurecast/TrendingBoardPageContent';

export default function FutureCastTrendingPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="trending" testId="futurecast-trending-page">
      <TrendingBoardPageContent />
    </FutureCastElitePageShell>
  );
}
