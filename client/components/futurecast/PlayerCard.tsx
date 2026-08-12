/**
 * Big Board player card — VaultBigBoardCard (Intelligence Rank chrome).
 */
'use client';

import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { VaultBigBoardCard, modelFromIntel } from '@/components/futurecast/VaultBigBoardCard';

export interface PlayerCardProps {
  player: BigBoardPlayer;
  /** @deprecated Cards navigate via VaultNavLink — kept for call-site compat. */
  onClick?: (player: BigBoardPlayer) => void;
}

export function PlayerCard({ player }: PlayerCardProps): React.ReactElement {
  return (
    <div data-testid="player-card" data-slug={player.slug}>
      <VaultBigBoardCard model={modelFromIntel(player)} profileContext="futurecast" />
    </div>
  );
}
