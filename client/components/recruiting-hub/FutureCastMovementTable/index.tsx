'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';

type Props = {
  players: HighPriorityPlayer[];
};

type SortKey = 'name' | 'ufProbability' | 'movement' | 'fitScore';

function ufPct(p: HighPriorityPlayer): number | null {
  const raw = p.ufProbability;
  if (raw == null || Number.isNaN(Number(raw))) return null;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function movementDelta(p: HighPriorityPlayer): number {
  return p.delta7d ?? p.movementDelta ?? 0;
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
  return p.notePreview?.trim() || p.insiderNotes?.trim() || p.skinny?.trim() || 'Intel pending';
}

function MovementSparkline({ end, delta }: { end: number; delta: number }): React.ReactElement {
  const start = Math.max(0, Math.min(100, end - delta));
  const pts = [start, start + delta * 0.25, start + delta * 0.5, start + delta * 0.75, end];
  const coords = pts.map((v, i) => `${(i / 4) * 40},${22 - (v / 100) * 18}`).join(' ');
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <svg className={`rh-movement-sparkline rh-movement-sparkline--${trend}`} viewBox="0 0 40 24" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MovementBadge({ delta }: { delta: number }): React.ReactElement {
  if (delta > 0) {
    return (
      <span className="rh-movement-badge rh-movement-badge--rise">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↑
        </span>
        +{Math.abs(delta)}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="rh-movement-badge rh-movement-badge--fall">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↓
        </span>
        {delta}%
      </span>
    );
  }
  return (
    <span className="rh-movement-badge rh-movement-badge--flat">
      <span className="rh-movement-badge__icon" aria-hidden>
        →
      </span>
      —
    </span>
  );
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
        av = ufPct(a) ?? -1;
        bv = ufPct(b) ?? -1;
      } else if (sortKey === 'movement') {
        av = movementDelta(a);
        bv = movementDelta(b);
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
            {rows.map((p) => {
              const delta = movementDelta(p);
              const intel = lastIntel(p);
              const pct = ufPct(p);
              const hasAnalystNote = intel !== 'Intel pending';

              return (
                <tr key={p.slug}>
                  <td>
                    <a href={playerProfileRoute(p.slug, 'futurecast')} className="rh-fc-table__player">
                      <strong>{p.name}</strong>
                      <span>
                        {p.position}
                        {p.school ? ` · ${p.school}` : ''}
                      </span>
                    </a>
                  </td>
                  <td className="rh-fc-table__pct">{pct == null ? '—' : `${pct}%`}</td>
                  <td className="rh-fc-table__move">
                    <div className="rh-movement-stock-row__right">
                      {pct == null ? (
                        <span className="rh-movement-badge rh-movement-badge--flat">RPM pending</span>
                      ) : (
                        <>
                          <MovementSparkline end={pct} delta={delta} />
                          <MovementBadge delta={delta} />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="rh-fc-table__intel">
                    {hasAnalystNote ? (
                      <div className="rh-analyst-signals">
                        <span className="rh-analyst-signals__label">Analyst Signals</span>
                        <p className="rh-analyst-signals__text">{intel}</p>
                      </div>
                    ) : (
                      <span className="rh-analyst-signals__text">{intel}</span>
                    )}
                  </td>
                  <td>{competingSchools(p)}</td>
                  <td>{p.fitScore != null ? Math.round(p.fitScore) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
