'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { HomeGameDayView } from '@/components/home/premium/command/home-command-utils';
import {
  computeKickoffProgress,
  gameDayBadge,
} from '@/components/home/premium/command/home-command-utils';
import { isFootballSeason } from '@/lib/recruiting-cycle';
import { opponentLogoUrl, ufLogoUrl } from '@/lib/team-logos';

type Props = {
  game: HomeGameDayView;
};

type KickClock = {
  countdown: string;
  progressPct: number;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
  isLive: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function HomeCommandGameDay({ game }: Props): React.ReactElement {
  const inSeason = useMemo(() => isFootballSeason(), []);
  const [clock, setClock] = useState<KickClock>(() => computeKickoffProgress(game.kickoffIso));
  const [badge, setBadge] = useState<string | null>(null);
  const ufLogo = ufLogoUrl();
  const oppLogo = opponentLogoUrl(game.gameId);

  useEffect(() => {
    const update = () => {
      const result = computeKickoffProgress(game.kickoffIso);
      setClock(result);
      setBadge(gameDayBadge(result.daysLeft, game.isRival));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [game.kickoffIso, game.isRival]);

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">{inSeason ? 'Game Week' : 'GameDay Countdown'}</h2>
        <p className="home-wow-section-subtitle">
          {inSeason ? 'Matchup prep, kickoff intel, and Gators Live.' : 'Next kickoff, front and center.'}
        </p>
      </div>
      <section
        className={`home-wow-card home-wow-gameday-card home-wow-gameday-card--elite${
          inSeason ? ' home-wow-gameday-card--in-season' : ''
        }`}
        data-testid="home-gameday-countdown"
      >
        <div className="home-wow-gameday-elite__top">
          <p className="home-wow-gameday-elite__kicker">{inSeason ? 'Next kickoff' : 'Countdown'}</p>
          {badge ? <span className="home-wow-gameday-elite__badge">{badge}</span> : null}
        </div>

        <div className="home-wow-gameday-elite__matchup">
          <div className="home-wow-gameday-elite__team">
            <img
              className="home-wow-gameday-elite__logo"
              src={ufLogo}
              alt="Florida"
              width={52}
              height={52}
              loading="lazy"
            />
            <span className="home-wow-gameday-elite__team-name">Florida</span>
          </div>
          <span className="home-wow-gameday-elite__vs" aria-hidden="true">
            VS
          </span>
          <div className="home-wow-gameday-elite__team">
            <img
              className="home-wow-gameday-elite__logo"
              src={oppLogo}
              alt={game.opponent}
              width={52}
              height={52}
              loading="lazy"
            />
            <span className="home-wow-gameday-elite__team-name">{game.opponent}</span>
          </div>
        </div>

        <p className="home-wow-gameday-elite__when">
          {game.dateLabel}
          {game.venue ? ` · ${game.venue}` : ''}
        </p>

        {clock.isLive ? (
          <p className="home-wow-gameday-elite__live">{clock.countdown}</p>
        ) : (
          <div className="home-wow-gameday-elite__clock" aria-label={clock.countdown}>
            <div className="home-wow-gameday-elite__unit home-wow-gameday-elite__unit--days">
              <span className="home-wow-gameday-elite__num">{clock.daysLeft}</span>
              <span className="home-wow-gameday-elite__unit-label">Days</span>
            </div>
            <div className="home-wow-gameday-elite__unit">
              <span className="home-wow-gameday-elite__num">{pad2(clock.hoursLeft)}</span>
              <span className="home-wow-gameday-elite__unit-label">Hrs</span>
            </div>
            <div className="home-wow-gameday-elite__unit">
              <span className="home-wow-gameday-elite__num">{pad2(clock.minutesLeft)}</span>
              <span className="home-wow-gameday-elite__unit-label">Min</span>
            </div>
            <div className="home-wow-gameday-elite__unit home-wow-gameday-elite__unit--sec">
              <span className="home-wow-gameday-elite__num">{pad2(clock.secondsLeft)}</span>
              <span className="home-wow-gameday-elite__unit-label">Sec</span>
            </div>
          </div>
        )}

        <div className="home-wow-gameday-elite__bar" aria-hidden="true">
          <div className="home-wow-gameday-elite__bar-fill" style={{ width: `${clock.progressPct}%` }} />
        </div>

        <a className="home-wow-gameday-elite__cta" href="/vault/game-week/">
          Open Game Week
        </a>
      </section>
    </>
  );
}
