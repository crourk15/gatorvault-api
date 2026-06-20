'use client';

import React from 'react';
import type { HomeGameDayView } from '@/components/home/premium/command/home-command-utils';
import { opponentInitials } from '@/components/home/premium/command/home-command-utils';

type Props = {
  game: HomeGameDayView;
};

export function HomeCommandGameDay({ game }: Props): React.ReactElement {
  return (
    <>
      <div className="home-section-header">
        <h2 className="home-section-title">GameDay Countdown</h2>
        <p className="home-section-subtitle">Next kickoff, front and center.</p>
      </div>
      <section className="home-card home-gameday-card" data-testid="home-gameday-countdown">
        <div className="home-gameday-logo" aria-hidden="true">
          {opponentInitials(game.opponent)}
        </div>
        <div className="home-gameday-main">
          <p className="home-gameday-opponent">Florida vs {game.opponent}</p>
          <p className="home-gameday-date">{game.dateLabel}</p>
          <p className="home-gameday-countdown">{game.countdownLabel}</p>
          <p className="home-gameday-meta">Kickoff locked. Gators locked in.</p>
        </div>
      </section>
    </>
  );
}
