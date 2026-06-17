'use client';

import React from 'react';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { SITE_ROUTES, gameWeekRoute } from '@/lib/site-routes';
import { ProbabilityGauge } from '@/components/ui/ProbabilityGauge';
import './HomeUpcomingGames.css';

export function HomeUpcomingGames(): React.ReactElement {
  const upcoming = SCHEDULE_GAMES.slice(0, 3);

  return (
    <section
      className="gv-home__cell gv-home__cell--12 gv-home-games"
      aria-label="Upcoming games"
      data-testid="home-upcoming-games"
    >
      <div className="gv-home-games__header">
        <h2 className="gv-home-panel__title">Upcoming Games</h2>
        <a href={SITE_ROUTES.schedule} className="gv-home-card__link">
          Full schedule →
        </a>
      </div>
      <div className="gv-home-games__grid">
        {upcoming.map((game) => (
          <a key={game.id} href={gameWeekRoute(game.id)} className="gv-home-games__card">
            <p className="gv-home-games__date">{game.date}</p>
            <h3 className="gv-home-games__matchup">vs {game.opp}</h3>
            <p className="gv-home-games__venue">{game.venue}</p>
            <div className="gv-home-games__gauge">
              <ProbabilityGauge value={game.ufPct} label="UF Win Prob" size={80} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
