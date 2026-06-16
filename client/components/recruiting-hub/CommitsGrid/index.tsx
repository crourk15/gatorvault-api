'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { CommitCard } from './CommitCard';

type Props = {
  players: RecruitingBoardPlayer[];
  title: string;
  emptyMessage?: string;
  loading?: boolean;
};

function CommitsSkeleton(): React.ReactElement {
  return (
    <div className="rh-commits-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rh-skeleton rh-skeleton--commit" />
      ))}
    </div>
  );
}

export function CommitsGrid({
  players,
  title,
  emptyMessage = 'No players loaded.',
  loading,
}: Props): React.ReactElement {
  return (
    <section className="rh-commits-grid-section rh-frame" data-testid="rh-commits-grid">
      <h2 className="rh-section-title">{title}</h2>
      {loading ? (
        <CommitsSkeleton />
      ) : players.length === 0 ? (
        <p className="rh-muted">{emptyMessage}</p>
      ) : (
        <div className="rh-commits-grid">
          {players.map((player) => (
            <CommitCard key={player.slug} player={player} />
          ))}
        </div>
      )}
    </section>
  );
}
