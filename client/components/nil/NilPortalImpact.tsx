'use client';

import React from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  portal: NilEliteBundle['portal'];
};

export function NilPortalImpact({ portal }: Props): React.ReactElement {
  const watch = portal.watchlist || [];
  const arrivals = portal.rosterArrivals || [];

  return (
    <section className="nil-elite-section" data-testid="nil-portal-impact">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Portal Pressure</h2>
          <p className="nil-elite-section__sub">
            Real portal likelihood and roster transfer arrivals — not invented NIL packages.
          </p>
        </div>
      </header>

      <div className="nil-portal-grid">
        <div className="nil-portal-col nil-portal-col--gain">
          <h3 className="nil-portal-col__title">UF portal watch</h3>
          <ul className="nil-portal-col__list">
            {watch.length === 0 ? (
              <li className="nil-portal-col__empty">
                {portal.watchlistError
                  ? 'Portal watchlist warming — roster arrivals still show below.'
                  : 'No elevated UF-interest portal names in this window.'}
              </li>
            ) : (
              watch.map((row) => {
                const body = (
                  <>
                    <div className="nil-portal-col__head">
                      <strong>{row.name}</strong>
                      <span className="nil-portal-col__pos">{row.position}</span>
                    </div>
                    <div className="nil-portal-col__range">
                      Likelihood {row.portalLikelihood}% · Depth risk {row.depthChartRisk}
                    </div>
                    <p className="nil-portal-col__note">Volatility {row.volatility}</p>
                  </>
                );
                return (
                  <li key={row.id} className="nil-portal-col__item nil-portal-col__item--link">
                    {row.slug ? (
                      <PlayerNavLink
                        href={playerProfileRoute(row.slug, 'futurecast')}
                        className="nil-portal-col__link"
                      >
                        {body}
                      </PlayerNavLink>
                    ) : (
                      body
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="nil-portal-col nil-portal-col--loss">
          <h3 className="nil-portal-col__title">Roster arrivals (transfers)</h3>
          <ul className="nil-portal-col__list">
            {arrivals.length === 0 ? (
              <li className="nil-portal-col__empty">No transfer arrivals tagged on the roster file.</li>
            ) : (
              arrivals.map((row) => (
                <li key={row.id} className="nil-portal-col__item">
                  <div className="nil-portal-col__head">
                    <strong>{row.name}</strong>
                    <span className="nil-portal-col__pos">{row.position}</span>
                  </div>
                  <div className="nil-portal-col__range">{row.transferInfo}</div>
                  <p className="nil-portal-col__note">
                    {row.stars != null ? `${row.stars}★` : 'Roster'}
                    {row.nationalRank != null ? ` · #${row.nationalRank}` : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
