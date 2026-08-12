/**
 * Portal Watchlist card — VaultBigBoardCard chrome.
 */
'use client';

import React from 'react';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import { VaultBigBoardCard, modelFromPortal } from '@/components/futurecast/VaultBigBoardCard';

export function PortalWatchlistCard({
  player,
}: {
  player: PortalWatchlistHomePlayer;
}): React.ReactElement {
  return <VaultBigBoardCard model={modelFromPortal(player)} profileContext="futurecast" />;
}
