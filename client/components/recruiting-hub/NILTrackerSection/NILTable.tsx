'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NILVerticalCard } from './NILVerticalCard';

type Props = {
  players: HighPriorityPlayer[];
};

export function NILTable({ players }: Props): React.ReactElement {
  return (
    <div className="rh-nil-table rh-nil-table--vertical">
      <div className="rh-nil-card-stack">
        {players.slice(0, 8).map((p) => (
          <NILVerticalCard key={p.slug} player={p} />
        ))}
      </div>
    </div>
  );
}
