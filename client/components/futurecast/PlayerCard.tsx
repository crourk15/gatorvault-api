/**
 * Big Board player card — ClassicRecruitCard only.
 * Elite four-metric cards use TrendingPlayerCard, HighPriorityTargetCard, etc.
 * Metric definitions: client/lib/futurecast-elite-metrics.ts
 */
'use client';

import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromBigBoard } from '@/lib/recruiting-card-adapters';

export interface PlayerCardProps {
  player: BigBoardPlayer;
  /** @deprecated Cards navigate via VaultNavLink — kept for call-site compat. */
  onClick?: (player: BigBoardPlayer) => void;
}

export function PlayerCard({ player }: PlayerCardProps): React.ReactElement {
  return (
    <div data-testid="player-card" data-slug={player.slug}>
      <ClassicRecruitCard
        player={fromBigBoard(player)}
        variant="target"
        rank={player.rank}
        profileContext="futurecast"
      />
    </div>
  );
}
