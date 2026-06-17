'use client';

import React from 'react';
import type { HomeUpcomingGamesData } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  data: HomeUpcomingGamesData | null;
  loading?: boolean;
};

export function HomeUpcomingGames({ data, loading }: Props): React.ReactElement {
  const games = data?.games ?? [];

  if (loading && !data) {
    return (
      <article className="gv-home__cell gv-home__cell--12" aria-label="Upcoming games" data-testid="home-upcoming-games">
        <div className="gv-home-skeleton gv-home-skeleton--card" style={{ minHeight: 220 }} />
      </article>
    );
  }

  return (
    <article className="gv-home__cell gv-home__cell--12" aria-label="Upcoming games" data-testid="home-upcoming-games">
      <div className="gv-home-card">
        <div className="gv-home-card__accent" />
        <h2 className="gv-home-card__title">Upcoming Games</h2>
        <div className="gv-home-grid gv-home-grid--three">
          {games.map((g) => (
            <div key={g.id} className="gv-home-gamecard">
              <div className="gv-home-gamecard__header">
                <span className="gv-home-meta">
                  {g.dateLabel} · {g.timeLabel}
                </span>
                <h3 className="gv-home-subtitle">vs {g.opponent}</h3>
                <p className="gv-home-body">{g.venue}</p>
              </div>
              <div className="gv-home-gamecard__prob">
                <span className="gv-home-label">Win probability</span>
                <span className="gv-home-prob">{g.probability}%</span>
              </div>
            </div>
          ))}
        </div>
        <a href={SITE_ROUTES.schedule} className="gv-home-link">
          Explore the Vault →
        </a>
      </div>
    </article>
  );
}
