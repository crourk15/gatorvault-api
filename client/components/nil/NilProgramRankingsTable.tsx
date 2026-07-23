'use client';

import React from 'react';
import type { NilEliteLandscape } from '@/lib/nil-elite-api';

type Props = {
  landscape: NilEliteLandscape;
};

export function NilProgramRankingsTable({ landscape }: Props): React.ReactElement {
  const rows = landscape.sec || [];

  return (
    <section className="nil-elite-section" data-testid="nil-sec-landscape">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">SEC NIL landscape</h2>
          <p className="nil-elite-section__sub">{landscape.sourceNote}</p>
        </div>
      </header>
      <div className="nil-rank-table-wrap">
        <table className="nil-rank-table">
          <thead>
            <tr>
              <th>SEC</th>
              <th>School</th>
              <th>Collective</th>
              <th>Pool est.</th>
              <th>Avg deal</th>
              <th>Top deal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.id === 'uf' ? 'is-uf' : undefined}>
                <td>{row.secRank != null ? `#${row.secRank}` : '—'}</td>
                <td>{row.school}</td>
                <td>{row.collective || '—'}</td>
                <td className="nil-rank-table__pool">
                  {row.estimatedAnnualPoolM != null ? `~$${row.estimatedAnnualPoolM}M` : '—'}
                </td>
                <td>{row.avgDealK != null ? `$${row.avgDealK}K` : '—'}</td>
                <td>{row.topDealM != null ? `$${row.topDealM}M` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {landscape.asOf ? (
          <p className="nil-elite-section__sub">As of {new Date(landscape.asOf).toLocaleDateString()}</p>
        ) : null}
        <p className="nil-elite-section__sub">{landscape.disclaimer}</p>
      </div>
    </section>
  );
}
