'use client';

import React, { useMemo, useState } from 'react';
import type { NilDashboard, NilProgramRow } from '@/lib/nil-api';
import {
  blueChipRetention,
  collectiveStrength,
  formatNilPool,
  isUfProgram,
  nilTrendArrow,
  nilTrendTone,
  portalCompetitiveness,
  programDisplayName,
  strengthBarPct,
} from './nil-program-metrics';

type RankView = 'sec' | 'national';

type Props = {
  dashboard: NilDashboard;
};

function rankForView(row: NilProgramRow, view: RankView): number {
  if (view === 'sec') return row.ranking?.secRank ?? 99;
  return row.ranking?.nationalRank ?? 99;
}

function rowsForView(dashboard: NilDashboard, view: RankView): NilProgramRow[] {
  const source = view === 'sec' ? dashboard.secRankings ?? [] : dashboard.nationalRankings ?? [];
  const key = view === 'sec' ? 'secRank' : 'nationalRank';
  return [...source]
    .filter((row) => row.ranking?.[key] != null)
    .sort((a, b) => rankForView(a, view) - rankForView(b, view));
}

function StrengthCell({ value, heat = false }: { value: number; heat?: boolean }): React.ReactElement {
  const pct = strengthBarPct(value);
  const tone = heat ? (value >= 75 ? 'high' : value >= 55 ? 'mid' : 'low') : 'score';
  return (
    <div className="nil-rank-table__meter">
      <div className="nil-rank-table__meter-track">
        <div className={`nil-rank-table__meter-fill nil-rank-table__meter-fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="nil-rank-table__meter-val">{value}</span>
    </div>
  );
}

function RankingsTableBody({ rows, view }: { rows: NilProgramRow[]; view: RankView }): React.ReactElement {
  if (!rows.length) {
    return <p className="rh-cc-empty">No ranking data loaded.</p>;
  }

  return (
    <div className="nil-rank-table-wrap">
      <table className="nil-rank-table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">School</th>
            <th scope="col">Est. NIL Pool</th>
            <th scope="col">Trend</th>
            <th scope="col">Collective Strength</th>
            <th scope="col">Portal NIL</th>
            <th scope="col">Blue-Chip Retention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rank = rankForView(row, view);
            const trend = nilTrendTone(row.metrics?.trend);
            const uf = isUfProgram(row);
            return (
              <tr key={row.id} className={uf ? 'is-uf' : undefined}>
                <td className="nil-rank-table__rank">#{rank}</td>
                <td className="nil-rank-table__school">
                  <strong>{programDisplayName(row)}</strong>
                  {row.collective ? <span className="nil-rank-table__collective">{row.collective}</span> : null}
                </td>
                <td className="nil-rank-table__pool">{formatNilPool(row.metrics?.estimatedAnnualPoolM)}</td>
                <td>
                  <span className={`nil-rank-table__trend nil-rank-table__trend--${trend}`}>
                    {nilTrendArrow(row.metrics?.trend)}
                    {row.metrics?.trendPct != null ? ` ${Math.abs(row.metrics.trendPct)}%` : ''}
                  </span>
                </td>
                <td>
                  <StrengthCell value={collectiveStrength(row)} />
                </td>
                <td>
                  <StrengthCell value={portalCompetitiveness(row)} heat />
                </td>
                <td>
                  <StrengthCell value={blueChipRetention(row)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NilProgramRankingsTable({ dashboard }: Props): React.ReactElement {
  const [view, setView] = useState<RankView>('sec');
  const secRows = useMemo(() => rowsForView(dashboard, 'sec'), [dashboard]);
  const nationalRows = useMemo(() => rowsForView(dashboard, 'national'), [dashboard]);
  const rows = view === 'sec' ? secRows : nationalRows;

  return (
    <section className="nil-elite-section" data-testid="nil-program-rankings">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">NIL Competitive Landscape</h2>
          <p className="nil-elite-section__sub">
            Full SEC and national standings — pool size, collective strength, portal pressure, and retention.
          </p>
        </div>
      </header>

      <div className="rh-cc-tabs" role="tablist" aria-label="NIL ranking scope">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'sec'}
          className={`rh-cc-tabs__btn${view === 'sec' ? ' is-active' : ''}`}
          onClick={() => setView('sec')}
        >
          SEC Rankings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'national'}
          className={`rh-cc-tabs__btn${view === 'national' ? ' is-active' : ''}`}
          onClick={() => setView('national')}
        >
          National Rankings
        </button>
      </div>

      <RankingsTableBody rows={rows} view={view} />
    </section>
  );
}
