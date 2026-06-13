/**
 * Portal Watchlist card — ClassicRecruitCard only.
 */
'use client';

import React from 'react';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromPortalWatchlist } from '@/lib/recruiting-card-adapters';

export function PortalWatchlistCard({
  player,
}: {
  player: PortalWatchlistHomePlayer;
}): React.ReactElement {
  return (
    <ClassicRecruitCard
      player={fromPortalWatchlist(player)}
      variant="target"
      rank={player.rank}
    />
  );
}
