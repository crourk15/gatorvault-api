'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { useIsNarrowHub } from '@/hooks/useIsNarrowHub';
import { NILRow } from './NILRow';
import { NILVerticalCard } from './NILVerticalCard';
import './nil-vertical-card.css';

type Props = {
  players: HighPriorityPlayer[];
};

export function NILTable({ players }: Props): React.ReactElement {
  const narrow = useIsNarrowHub();
  const rows = players.slice(0, 8);

  if (narrow) {
    return (
      <div className="rh-nil-table rh-nil-table--mobile">
        <div className="rh-nil-card-stack">
          {rows.map((p) => (
            <NILVerticalCard key={p.slug} player={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rh-nil-table">
      <table className="rh-nil-table__grid">
        <thead>
          <tr>
            <th>Player</th>
            <th>On3 NIL Est.</th>
            <th>UF NIL Fit</th>
            <th>Market Trend</th>
            <th>Position Market</th>
            <th>Comfort Zone</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <NILRow key={p.slug} player={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
