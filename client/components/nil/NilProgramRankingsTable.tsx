'use client';

import React, { useState } from 'react';
import type { NilEliteLandscape } from '@/lib/nil-elite-api';

type Props = {
  landscape: NilEliteLandscape;
};

export function NilProgramRankingsTable({ landscape }: Props): React.ReactElement {
  const [tab, setTab] = useState<'sec' | 'national'>('sec');
  const secRows = landscape.sec || [];
  const nationalRows = landscape.nationalTop || [];

  return (
    <section className="nil-elite-section" data-testid="nil-sec-landscape">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Sideline Market Index</h2>
          <p className="nil-elite-section__sub">{landscape.sourceNote}</p>
        </div>
      </header>

      {landscape.headline ? (
        <div className="nil-index-headline">
          <article>
            <span>Indexed market</span>
            <strong>
              {landscape.headline.indexedMarketB != null
                ? `$${landscape.headline.indexedMarketB}B`
                : '—'}
            </strong>
          </article>
          <article>
            <span>Top program</span>
            <strong>
              {landscape.headline.topProgram || '—'}
              {landscape.headline.topProgramMarketM != null
                ? ` · $${landscape.headline.topProgramMarketM}M`
                : ''}
            </strong>
          </article>
          <article>
            <span>{landscape.headline.benefitsCapNote || 'Benefits cap'}</span>
            <strong>
              {landscape.headline.benefitsCapM != null
                ? `~$${landscape.headline.benefitsCapM}M`
                : '—'}
            </strong>
          </article>
        </div>
      ) : null}

      <div className="rh-cc-tabs" role="tablist" aria-label="Market index scope">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sec'}
          className={`rh-cc-tabs__btn${tab === 'sec' ? ' is-active' : ''}`}
          onClick={() => setTab('sec')}
        >
          SEC
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'national'}
          className={`rh-cc-tabs__btn${tab === 'national' ? ' is-active' : ''}`}
          onClick={() => setTab('national')}
        >
          National top 25
        </button>
      </div>

      <div className="nil-rank-table-wrap">
        {tab === 'sec' ? (
          <table className="nil-rank-table">
            <thead>
              <tr>
                <th>SEC</th>
                <th>Natl</th>
                <th>School</th>
                <th>Collective</th>
                <th>Market</th>
              </tr>
            </thead>
            <tbody>
              {secRows.map((row) => (
                <tr key={row.id} className={row.id === 'uf' ? 'is-uf' : undefined}>
                  <td>{row.secRank != null ? `#${row.secRank}` : '—'}</td>
                  <td>{row.nationalRank != null ? `#${row.nationalRank}` : '—'}</td>
                  <td>{row.school}</td>
                  <td>{row.collective || '—'}</td>
                  <td className="nil-rank-table__pool">
                    {row.estimatedAnnualPoolM != null
                      ? `$${Number(row.estimatedAnnualPoolM).toFixed(1)}M`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="nil-rank-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>School</th>
                <th>Conf</th>
                <th>Market</th>
              </tr>
            </thead>
            <tbody>
              {nationalRows.map((row) => (
                <tr
                  key={`${row.nationalRank}-${row.school}`}
                  className={row.programId === 'uf' || row.school === 'Florida' ? 'is-uf' : undefined}
                >
                  <td>#{row.nationalRank}</td>
                  <td>{row.school}</td>
                  <td>{row.conference}</td>
                  <td className="nil-rank-table__pool">${Number(row.marketM).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {landscape.asOf ? (
          <p className="nil-elite-section__sub">As of {landscape.asOf}</p>
        ) : null}
        <p className="nil-elite-section__sub">
          {landscape.provider || 'Sideline'}
          {landscape.programsIndexed != null ? ` · ${landscape.programsIndexed} programs` : ''}
          {'. '}
          {landscape.disclaimer}
        </p>
      </div>
    </section>
  );
}
