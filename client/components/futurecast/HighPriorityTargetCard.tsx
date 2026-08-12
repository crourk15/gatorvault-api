'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { highPriorityToLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { VaultChaseCard } from '@/components/futurecast/VaultChaseCard';

/**
 * High-priority / 2028 chase board card - shared VaultChaseCard surface.
 */
export function HighPriorityTargetCard({
  player,
  rank,
  compact: _compact = false,
  movementNarrative: _movementNarrative,
}: {
  player: HighPriorityPlayer;
  rank?: number;
  compact?: boolean;
  movementNarrative?: string | null;
}): React.ReactElement {
  const resolvedRank = rank ?? 1;
  return (
    <VaultChaseCard
      player={highPriorityToLabTarget(player)}
      rank={resolvedRank}
      showRace={resolvedRank === 1}
      profileContext="recruiting"
    />
  );
}
