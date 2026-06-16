'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { RecruitingEvalSections } from '@/components/vault/recruiting/RecruitingEvalSections';
import { PositionIcon } from '@/components/recruiting-hub/Icons/PositionIcon';
import { formatRank, playerPos } from '@/components/recruiting-hub/utils/formatRank';

type Props = {
  player: RecruitingBoardPlayer;
};

export function CommitEvalCard({ player }: Props): React.ReactElement {
  const pos = playerPos(player);
  return (
    <article className="rh-commit-eval-card">
      <div className="rh-commit-eval-card__head">
        <PositionIcon position={pos} size="sm" />
        <h4 className="rh-commit-eval-card__name">{player.name}</h4>
      </div>
      <p className="rh-commit-eval-card__meta">
        {pos} · NATL {formatRank(player.natlRank ?? player.natl)} ·{' '}
        {player.stars ? `${player.stars}★` : '—'}
        {player.fitScore != null ? ` · Fit ${Math.round(Number(player.fitScore))}` : ''}
      </p>
      <RecruitingEvalSections player={player} />
    </article>
  );
}
