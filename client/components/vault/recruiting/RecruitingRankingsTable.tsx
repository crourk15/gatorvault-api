'use client';

import React, { useMemo, useState } from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
  starsDisplay,
} from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { playerStatusLabel } from '@/lib/recruiting-hub-utils';
import { ensurePlayerSlug } from '@/lib/slug';

type SortKey =
  | 'name'
  | 'pos'
  | 'stars'
  | 'composite'
  | 'natl'
  | 'posRank'
  | 'stateRank'
  | 'status'
  | 'uf';

type Props = {
  players: RecruitingBoardPlayer[];
  year: number;
};

export function RankingsTable({ players, year }: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('uf');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const list = [...players];
    const mult = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'pos':
          return mult * playerPos(a).localeCompare(playerPos(b));
        case 'stars':
          return mult * ((Number(a.stars) || 0) - (Number(b.stars) || 0));
        case 'composite': {
          const ca = playerRating(a) || Number(a.rating) || 0;
          const cb = playerRating(b) || Number(b.rating) || 0;
          return mult * (ca - cb);
        }
        case 'natl':
          return mult * ((a.natlRank ?? a.natl ?? 9999) - (b.natlRank ?? b.natl ?? 9999));
        case 'posRank':
          return mult * ((a.posRank ?? 9999) - (b.posRank ?? 9999));
        case 'stateRank':
          return mult * ((a.stateRank ?? 9999) - (b.stateRank ?? 9999));
        case 'status':
          return mult * playerStatusLabel(a).localeCompare(playerStatusLabel(b));
        case 'uf':
        default: {
          const ua = Number(a.ufProbability) || Number(a.fitScore) || 0;
          const ub = Number(b.ufProbability) || Number(b.fitScore) || 0;
          return mult * (ua - ub);
        }
      }
    });
    return list.slice(0, 75);
  }, [players, sortKey, sortAsc]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === 'name' || key === 'natl' || key === 'posRank' || key === 'stateRank');
    }
  };

  const th = (key: SortKey, label: string) => (
    <th
      className={sortKey === key ? 'is-sorted' : undefined}
      onClick={() => onSort(key)}
      aria-sort={sortKey === key ? (sortAsc ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="gv-rh-rankings-wrap" data-testid="recruiting-rankings-table">
      <table className="gv-rh-rankings">
        <thead>
          <tr>
            {th('name', 'Player')}
            {th('pos', 'Position')}
            {th('stars', 'Stars')}
            {th('composite', 'Composite')}
            {th('natl', "Nat'l Rank")}
            {th('posRank', 'Pos Rank')}
            {th('stateRank', 'State Rank')}
            {th('status', 'Status')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const href = playerProfilePath(
              ensurePlayerSlug(p.slug, p.name),
              recruitingProfileLifecycle(p),
              true,
              p.name,
              'recruiting'
            );
            const rating = playerRating(p) || Number(p.rating) || 0;
            const composite =
              rating > 0 ? formatCompositeRating(rating) : formatCompositeRating(p.displayRating);
            return (
              <tr key={ensurePlayerSlug(p.slug, p.name)}>
                <td>
                  <a href={href}>{p.name}</a>
                </td>
                <td>{playerPos(p)}</td>
                <td>{p.stars ? starsDisplay(p.stars) : '—'}</td>
                <td className="gv-rh-rankings__num">{composite ?? '—'}</td>
                <td>{formatRank(p.natlRank ?? p.natl)}</td>
                <td>{formatRank(p.posRank)}</td>
                <td>{formatRank(p.stateRank)}</td>
                <td>{playerStatusLabel(p, p.isCommittedToUF ? 'commit' : 'target')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="gv-rh-section-sub" style={{ padding: '1rem' }}>
          No {year} ranked targets.
        </p>
      )}
    </div>
  );
}

/** @deprecated use RankingsTable */
export const RecruitingRankingsTable = RankingsTable;
