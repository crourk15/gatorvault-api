'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { HeadlinerCard } from '@/components/vault/recruiting/HeadlinerCard';

type Props = {
  player: RecruitingBoardPlayer | null;
};

export function HeadlinerSpotlight({ player }: Props): React.ReactElement | null {
  if (!player) return null;

  return (
    <section className="rh-headliner rh-frame" data-testid="rh-headliner-spotlight">
      <h2 className="rh-section-title">Headliner Spotlight</h2>
      <HeadlinerCard player={player} />
    </section>
  );
}
