'use client';

import React, { useState } from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  editorial: NonNullable<NilEliteBundle['editorial']>;
};

/** Demoted editorial landscape — clearly labeled, never the page lead. */
export function NilProgramRankingsTable({ editorial }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const rows = editorial.sec || [];

  return (
    <section className="nil-elite-section nil-elite-section--editorial" data-testid="nil-editorial">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Editorial landscape</h2>
          <p className="nil-elite-section__sub">{editorial.disclaimer}</p>
        </div>
        <button
          type="button"
          className="nil-editorial-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Show'} estimates
        </button>
      </header>
      {open ? (
        <div className="nil-rank-table-wrap">
          <table className="nil-rank-table">
            <thead>
              <tr>
                <th>SEC</th>
                <th>School</th>
                <th>Collective</th>
                <th>Pool est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.id === 'uf' ? 'is-uf' : undefined}>
                  <td>{row.secRank != null ? `#${row.secRank}` : '—'}</td>
                  <td>{row.school}</td>
                  <td>{row.collective || '—'}</td>
                  <td>
                    {row.estimatedAnnualPoolM != null ? `~$${row.estimatedAnnualPoolM}M` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editorial.asOf ? (
            <p className="nil-elite-section__sub">As of {new Date(editorial.asOf).toLocaleDateString()}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
