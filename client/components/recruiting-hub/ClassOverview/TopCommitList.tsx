'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { CommitEvalCard } from './CommitEvalCard';

type Props = {
  players: RecruitingBoardPlayer[];
};

export function TopCommitList({ players }: Props): React.ReactElement | null {
  if (!players.length) return null;

  return (
    <div className="rh-top-commit-list">
      <h3 className="rh-top-commit-list__title">Top commits — full eval</h3>
      <div className="rh-top-commit-list__grid">
        {players.map((player) => (
          <CommitEvalCard key={player.slug} player={player} />
        ))}
      </div>
    </div>
  );
}
