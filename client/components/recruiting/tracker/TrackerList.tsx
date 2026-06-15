'use client';

import React from 'react';
import type { TrackerPlayer } from '@/lib/recruiting-tracker-types';
import { TrackerPlayerCard } from './TrackerPlayerCard';

type Props = {
  players: TrackerPlayer[];
};

export function TrackerList({ players }: Props): React.ReactElement {
  return (
    <div className="tracker-list" data-testid="tracker-list">
      {players.map((player) => (
        <TrackerPlayerCard key={player.id} player={player} />
      ))}
    </div>
  );
}
