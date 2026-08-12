'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { highPriorityToLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { VaultChaseCard } from '@/components/futurecast/VaultChaseCard';
import type { PlayerProfileContext } from '@/lib/vault-route-map';

/**
 * High-priority / 2028 chase board card - shared VaultChaseCard surface.
 * Lab Priority chase + recruiting HP board both use this path.
 */
export function HighPriorityTargetCard({
  player,
  rank,
  compact: _compact = false,
  movementNarrative: _movementNarrative,
  showMovement = true,
  showRace,
  profileContext = 'recruiting',
}: {
  player: HighPriorityPlayer;
  rank?: number;
  compact?: boolean;
  movementNarrative?: string | null;
  showMovement?: boolean;
  /** Defaults to race chart on #1 only. */
  showRace?: boolean;
  profileContext?: PlayerProfileContext;
}): React.ReactElement {
  const resolvedRank = rank ?? 1;
  return (
    <VaultChaseCard
      player={highPriorityToLabTarget(player)}
      rank={resolvedRank}
      showRace={showRace ?? resolvedRank === 1}
      showMovement={showMovement}
      profileContext={profileContext}
    />
  );
}
