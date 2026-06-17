'use client';

import React from 'react';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import { playerProfileRoute } from '@/lib/vault-route-map';

type Props = {
  portalPlayers: PortalWatchlistHomePlayer[];
};

export function FutureCastPortalWatchlist({ portalPlayers }: Props): React.ReactElement {
  const rows = portalPlayers.slice(0, 12);

  return (
    <section className="futurecast-page__section fc-panel" data-testid="fc-portal-watchlist">
      <h2 className="futurecast-page__section-title">Portal Watchlist</h2>
      <p className="futurecast-page__section-sub">Transfer targets with UF landing likelihood and fit signals.</p>

      {rows.length === 0 ? (
        <p className="fc-empty">No portal watchlist entries loaded.</p>
      ) : (
        <div className="fc-hscroll">
          {rows.map((p) => (
            <article key={p.id} className="fc-portal-card">
              <p className="fc-portal-card__name">{p.fullName}</p>
              <p className="fc-portal-card__meta">
                {p.position} · Class {p.classYear}
              </p>
              <p className="fc-portal-card__meta">
                Portal likelihood {Math.round(p.portalLikelihood)}% · Volatility {Math.round(p.volatility)}
              </p>
              <p className="fc-portal-card__meta">Depth chart risk {Math.round(p.depthChartRisk)}%</p>
              <a
                href={`${playerProfileRoute(p.slug, 'futurecast')}?tab=portal`}
                className="fc-card-link"
              >
                FutureCast →
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
