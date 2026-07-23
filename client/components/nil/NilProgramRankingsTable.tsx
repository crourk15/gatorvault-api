'use client';

import React, { useState } from 'react';
import type { NilEliteLandscape } from '@/lib/nil-elite-api';

type Props = {
  landscape: NilEliteLandscape;
};

export function NilProgramRankingsTable({ landscape }: Props): React.ReactElement {
  const [tab, setTab] = useState<'sec' | 'national'>('sec');
  const [expanded, setExpanded] = useState(false);
  const secRows = landscape.sec || [];
  const nationalRows = landscape.nationalTop || [];
  const uf = landscape.uf;
  const visibleSec = expanded ? secRows : secRows.slice(0, 6);
  const visibleNat = expanded ? nationalRows : nationalRows.slice(0, 8);

  return (
    <section className="nil-elite-section" data-testid="nil-sec-landscape">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Market Index</h2>
          <p className="nil-elite-section__sub">
            Sideline school markets — all-sport estimates, not football-only.
          </p>
        </div>
      </header>

      {landscape.headline || uf ? (
        <div className="nil-index-headline">
          <article>
            <span>Florida</span>
            <strong>
              {uf?.estimatedAnnualPoolM != null
                ? `$${Number(uf.estimatedAnnualPoolM).toFixed(1)}M`
                : '—'}
              {uf?.secRank != null ? ` · SEC #${uf.secRank}` : ''}
              {uf?.nationalRank != null ? ` · #${uf.nationalRank}` : ''}
            </strong>
          </article>
          <article>
            <span>Top program</span>
            <strong>
              {landscape.headline?.topProgram || 'Texas'}
              {landscape.headline?.topProgramMarketM != null
                ? ` · $${landscape.headline.topProgramMarketM}M`
                : ''}
            </strong>
          </article>
          <article>
            <span>Indexed market</span>
            <strong>
              {landscape.headline?.indexedMarketB != null
                ? `$${landscape.headline.indexedMarketB}B`
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
          National
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
                <th>Market</th>
              </tr>
            </thead>
            <tbody>
              {visibleSec.map((row) => (
                <tr key={row.id} className={row.id === 'uf' ? 'is-uf' : undefined}>
                  <td>{row.secRank != null ? `#${row.secRank}` : '—'}</td>
                  <td>{row.nationalRank != null ? `#${row.nationalRank}` : '—'}</td>
                  <td>{row.school}</td>
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
              {visibleNat.map((row) => (
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
        <button
          type="button"
          className="nil-editorial-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show full table'}
        </button>
        <p className="nil-elite-section__sub">
          {landscape.provider || 'Sideline'}
          {landscape.programsIndexed != null ? ` · ${landscape.programsIndexed} programs` : ''}
          . All-sport school markets.
        </p>
      </div>
    </section>
  );
}
