'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NILRow } from './NILRow';
import { NILVerticalCard } from './NILVerticalCard';

type Props = {
  players: HighPriorityPlayer[];
};

export function NILTable({ players }: Props): React.ReactElement {
  const rows = players.slice(0, 8);

  return (
    <div className="rh-nil-table rh-nil-table--responsive">
      <div className="rh-nil-table__desktop">
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

      <div className="rh-nil-card-stack">
        {rows.map((p) => (
          <NILVerticalCard key={p.slug} player={p} />
        ))}
      </div>
    </div>
  );
}
