'use client';

import React from 'react';
import type { FcLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { VaultChaseCard } from '@/components/futurecast/VaultChaseCard';
import { playerProfileRoute } from '@/lib/vault-route-map';

type Props = {
  player: FcLabTarget;
  rank: number;
  showMovement?: boolean;
};

/**
 * Priority chase card - shared VaultChaseCard (v12) for Lab + home unison.
 */
export function FutureCastChaseCard({
  player,
  rank,
}: Props): React.ReactElement {
  return (
    <VaultChaseCard
      player={player}
      rank={rank}
      showRace={rank === 1}
      profileContext="futurecast"
      href={playerProfileRoute(player.slug, 'futurecast')}
    />
  );
}
