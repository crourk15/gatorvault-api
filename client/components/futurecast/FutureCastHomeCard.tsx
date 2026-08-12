/**
 * FutureCast homepage player card — VaultBigBoardCard chrome.
 */
'use client';

import React from 'react';
import type { FeedPrediction } from '@/lib/predictions-api';
import { VaultBigBoardCard, modelFromPrediction } from '@/components/futurecast/VaultBigBoardCard';

export type FutureCastHomeCardVariant =
  | 'commit'
  | 'target'
  | 'trending-up'
  | 'trending-down';

export interface FutureCastHomeCardProps {
  prediction: FeedPrediction;
  variant: FutureCastHomeCardVariant;
}

export function FutureCastHomeCard({
  prediction,
  variant,
}: FutureCastHomeCardProps): React.ReactElement {
  return (
    <div data-testid={`home-card-${variant}`}>
      <VaultBigBoardCard model={modelFromPrediction(prediction)} profileContext="futurecast" />
    </div>
  );
}
