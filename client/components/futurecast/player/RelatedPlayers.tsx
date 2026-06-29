/**
 * Related players grid — ClassicRecruitCard only.
 */
'use client';

import React from 'react';
import type { BigBoardPlayer } from '../../../lib/big-board-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromBigBoard } from '@/lib/recruiting-card-adapters';

export interface RelatedPlayersProps {
  players: BigBoardPlayer[];
  currentSlug?: string;
}

export function RelatedPlayers({ players, currentSlug }: RelatedPlayersProps): React.ReactElement {
  const list = players.filter((p) => p.slug !== currentSlug);
  if (!list.length) {
    return <p className="fc-profile-empty">No related players in this class and position.</p>;
  }

  return (
    <div className="gv-rb-grid" data-testid="related-players">
      {list.map((p) => {
        const card = fromBigBoard(p);
        const variant = card.isCommittedToUF ? 'commit' : 'target';
        return (
          <ClassicRecruitCard key={p.id} player={card} variant={variant} rank={p.rank} />
        );
      })}
    </div>
  );
}
