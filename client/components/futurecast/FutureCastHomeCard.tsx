/**
 * FutureCast homepage player card — ClassicRecruitCard only.
 */
'use client';

import React from 'react';
import type { FeedPrediction } from '@/lib/predictions-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromFeedPrediction } from '@/lib/recruiting-card-adapters';

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
  const cardVariant = variant === 'commit' ? 'commit' : 'target';
  return (
    <div data-testid={`home-card-${variant}`}>
      <ClassicRecruitCard player={fromFeedPrediction(prediction, cardVariant)} variant={cardVariant} />
    </div>
  );
}
