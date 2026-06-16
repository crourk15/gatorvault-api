'use client';

import React from 'react';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { SITE_ROUTES, gameWeekRoute } from '@/lib/site-routes';
import { ProbabilityGauge } from '@/components/ui/ProbabilityGauge';

export function DashboardUpcomingGames(): React.ReactElement {
  const upcoming = SCHEDULE_GAMES.slice(0, 3);

  return (
    <section className="gv-dash-games gv-dash__section" aria-label="Upcoming games" data-testid="dashboard-upcoming-games">
      <div className="gv-dash__frame">
        <div className="gv-dash-games__header">
          <h2 className="gv-dash-today__heading">Upcoming Games</h2>
          <a href={SITE_ROUTES.schedule} className="gv-dash-card__link">
            Full schedule →
          </a>
        </div>
        <div className="gv-dash-games__grid">
          {upcoming.map((game) => (
            <a key={game.id} href={gameWeekRoute(game.id)} className="gv-dash-games__card">
              <p className="gv-dash-games__date">{game.date}</p>
              <h3 className="gv-dash-games__matchup">vs {game.opp}</h3>
              <p className="gv-dash-games__venue">{game.venue}</p>
              <div className="gv-dash-games__gauge">
                <ProbabilityGauge value={game.ufPct} label="UF Win Prob" size={80} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
