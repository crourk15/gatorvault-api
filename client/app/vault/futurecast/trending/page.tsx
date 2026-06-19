'use client';

import React from 'react';
import { FutureCastElitePageShell } from '@/components/futurecast/FutureCastElitePageShell';
import { TrendingBoardPageContent } from '@/components/futurecast/TrendingBoardPageContent';

export default function VaultFutureCastTrendingPage(): React.ReactElement {
  return (
    <FutureCastElitePageShell segment="trending" testId="vault-futurecast-trending-page">
      <TrendingBoardPageContent />
    </FutureCastElitePageShell>
  );
}
