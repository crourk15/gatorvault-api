'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NILRow } from './NILRow';

type Props = {
  players: HighPriorityPlayer[];
};

export function NILTable({ players }: Props): React.ReactElement {
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
          {players.slice(0, 8).map((p) => (
            <NILRow key={p.slug} player={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
