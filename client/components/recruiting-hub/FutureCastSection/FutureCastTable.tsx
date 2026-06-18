'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { FutureCastRow } from './FutureCastRow';
import { FutureCastVerticalCard } from './FutureCastVerticalCard';

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

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'ufProbability', label: 'UF Probability' },
  { key: 'movement', label: '7d Movement' },
  { key: 'fitScore', label: 'Fit Score' },
];

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
    <div className="rh-fc-table rh-fc-table--responsive">
      <div className="rh-fc-sort-bar" role="toolbar" aria-label="Sort FutureCast targets">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`rh-fc-sort-bar__btn${sortKey === key ? ' is-active' : ''}`}
            onClick={() => toggle(key)}
          >
            {label}
            {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      <div className="rh-fc-table__desktop">
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

      <div className="rh-fc-card-stack">
        {rows.map((p) => (
          <FutureCastVerticalCard key={p.slug} player={p} />
        ))}
      </div>
    </div>
  );
}
