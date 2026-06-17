'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { FutureCastRow } from './FutureCastRow';

type Props = {
  players: HighPriorityPlayer[];
};

type SortKey = 'ufProbability' | 'movement' | 'fitScore';

function sortPlayers(list: HighPriorityPlayer[], key: SortKey, asc: boolean): HighPriorityPlayer[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let av = 0;
    let bv = 0;
    if (key === 'ufProbability') {
      av = a.ufProbability ?? 0;
      bv = b.ufProbability ?? 0;
      if (av <= 1) av *= 100;
      if (bv <= 1) bv *= 100;
    } else if (key === 'movement') {
      av = a.delta7d ?? a.movementDelta ?? 0;
      bv = b.delta7d ?? b.movementDelta ?? 0;
    } else {
      av = a.fitScore ?? 0;
      bv = b.fitScore ?? 0;
    }
    return asc ? av - bv : bv - av;
  });
  return sorted;
}

export function FutureCastTable({ players }: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('ufProbability');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(
    () => sortPlayers(players, sortKey, sortAsc).slice(0, 12),
    [players, sortAsc, sortKey]
  );

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="rh-fc-table">
      <table className="rh-fc-table__grid">
        <thead>
          <tr>
            <th>Player</th>
            <th>
              <button type="button" className="rh-fc-table__sort" onClick={() => toggle('ufProbability')}>
                UF Probability %
              </button>
            </th>
            <th>
              <button type="button" className="rh-fc-table__sort" onClick={() => toggle('movement')}>
                Movement
              </button>
            </th>
            <th>Last Intel</th>
            <th>Competing Schools</th>
            <th>
              <button type="button" className="rh-fc-table__sort" onClick={() => toggle('fitScore')}>
                Fit Score
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <FutureCastRow key={p.slug} player={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
