/**
 * Big Board player card — ClassicRecruitCard only.
 */
'use client';

import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromBigBoard } from '@/lib/recruiting-card-adapters';

export interface PlayerCardProps {
  player: BigBoardPlayer;
  onClick?: (player: BigBoardPlayer) => void;
}

export function PlayerCard({ player, onClick }: PlayerCardProps): React.ReactElement {
  const card = (
    <ClassicRecruitCard player={fromBigBoard(player)} variant="target" rank={player.rank} />
  );

  if (!onClick) return card;

  return (
    <button
      type="button"
      className="gv-rb-card-button"
      onClick={() => onClick(player)}
      data-testid="player-card"
      data-slug={player.slug}
    >
      {card}
    </button>
  );
}
