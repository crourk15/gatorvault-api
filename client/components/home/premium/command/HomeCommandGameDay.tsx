'use client';

import React, { useEffect, useState } from 'react';
import type { HomeGameDayView } from '@/components/home/premium/command/home-command-utils';
import {
  computeKickoffProgress,
  gameDayBadge,
} from '@/components/home/premium/command/home-command-utils';

type Props = {
  game: HomeGameDayView;
};

export function HomeCommandGameDay({ game }: Props): React.ReactElement {
  const [countdown, setCountdown] = useState('');
  const [progress, setProgress] = useState(0);
  const [badge, setBadge] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const result = computeKickoffProgress(game.kickoffIso);
      setCountdown(result.countdown);
      setProgress(result.progressPct);
      setBadge(gameDayBadge(result.daysLeft, game.isRival));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [game.kickoffIso, game.isRival]);

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">GameDay Countdown</h2>
        <p className="home-wow-section-subtitle">Next kickoff, front and center.</p>
      </div>
      <section className="home-wow-card home-wow-gameday-card" data-testid="home-gameday-countdown">
        <div className="home-wow-gameday-logo-wrap">
          <span className="home-wow-gameday-logo-watermark" aria-hidden="true">
            UF
          </span>
          <div className="home-wow-gameday-logo" aria-hidden="true">
            {game.opponentShort}
          </div>
        </div>
        <div className="home-wow-gameday-main">
          <p className="home-wow-gameday-opponent">Florida vs {game.opponent}</p>
          <p className="home-wow-gameday-date">{game.dateLabel}</p>
          <p className="home-wow-gameday-countdown">{countdown}</p>
          <p className="home-wow-gameday-meta">Kickoff locked. Gators locked in.</p>
          <div className="home-wow-gameday-bar" aria-hidden="true">
            <div className="home-wow-gameday-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {badge ? <div className="home-wow-gameday-badge">{badge}</div> : null}
      </section>
    </>
  );
}
