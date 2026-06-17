'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';

type Props = {
  players: HighPriorityPlayer[];
};

type SortKey = 'name' | 'ufProbability' | 'movement' | 'fitScore';

function ufPct(p: HighPriorityPlayer): number {
  const raw = p.ufProbability;
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function movementArrow(delta: number): string {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
}

function competingSchools(p: HighPriorityPlayer): string {
  if (p.predictors?.length) {
    return p.predictors
      .slice(0, 3)
      .map((x) => x.name)
      .join(' · ');
  }
  if (p.committedTo) return p.committedTo;
  return '—';
}

function lastIntel(p: HighPriorityPlayer): string {
  return p.notePreview?.trim() || p.insiderNotes?.trim() || p.skinny?.trim() || 'Tracking active';
}

export function FutureCastMovementTable({ players }: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('ufProbability');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const list = [...players];
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'name') {
        av = a.name;
        bv = b.name;
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      if (sortKey === 'ufProbability') {
        av = ufPct(a);
        bv = ufPct(b);
      } else if (sortKey === 'movement') {
        av = a.delta7d ?? a.movementDelta ?? 0;
        bv = b.delta7d ?? b.movementDelta ?? 0;
      } else {
        av = a.fitScore ?? 0;
        bv = b.fitScore ?? 0;
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return list.slice(0, 12);
  }, [players, sortAsc, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <section className="rh-fc-table rh-frame" data-testid="rh-futurecast-table">
      <div className="rh-section-head">
        <h2 className="rh-section-title">FutureCast Movement</h2>
        <p className="rh-section-sub">Sortable probability, movement, and fit intel for priority targets.</p>
      </div>
      <div className="rh-fc-table__wrap">
        <table className="rh-fc-table__table">
          <thead>
            <tr>
              <th>
                <button type="button" className="rh-fc-table__sort" onClick={() => toggleSort('name')}>
                  Player
                </button>
              </th>
              <th>
                <button type="button" className="rh-fc-table__sort" onClick={() => toggleSort('ufProbability')}>
                  UF %
                </button>
              </th>
              <th>
                <button type="button" className="rh-fc-table__sort" onClick={() => toggleSort('movement')}>
                  Movement
                </button>
              </th>
              <th>Last Intel</th>
              <th>Competing Schools</th>
              <th>
                <button type="button" className="rh-fc-table__sort" onClick={() => toggleSort('fitScore')}>
                  Fit Score
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug}>
                <td>
                  <a href={playerProfileRoute(p.slug, 'futurecast')} className="rh-fc-table__player">
                    <strong>{p.name}</strong>
                    <span>{p.position}</span>
                  </a>
                </td>
                <td className="rh-fc-table__pct">{ufPct(p)}%</td>
                <td className="rh-fc-table__move">
                  {movementArrow(p.delta7d ?? p.movementDelta ?? 0)}{' '}
                  {Math.abs(p.delta7d ?? p.movementDelta ?? 0) || '—'}
                </td>
                <td className="rh-fc-table__intel">{lastIntel(p)}</td>
                <td>{competingSchools(p)}</td>
                <td>{p.fitScore != null ? Math.round(p.fitScore) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
