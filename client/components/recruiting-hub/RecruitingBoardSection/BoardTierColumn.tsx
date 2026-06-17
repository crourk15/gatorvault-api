'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { BoardCard } from './BoardCard';

type Props = {
  title: string;
  players: RecruitingBoardPlayer[];
};

export function BoardTierColumn({ title, players }: Props): React.ReactElement {
  return (
    <div className="rh-board-tier">
      <h3 className="rh-board-tier__title">{title}</h3>
      <div className="rh-board-tier__stack">
        {players.length === 0 ? (
          <p className="rh-section__empty">No targets in this tier.</p>
        ) : (
          players.map((p) => <BoardCard key={p.slug} player={p} />)
        )}
      </div>
    </div>
  );
}
