'use client';

import React from 'react';
import { ufLogoUrl, opponentLogoUrl } from '@/lib/team-logos';
import type { GameWeekBundle } from '@/lib/game-week-data';
import { CountdownWidget } from './CountdownWidget';

type Props = {
  bundle: GameWeekBundle;
};

export function MatchupHeroWidget({ bundle }: Props): React.ReactElement {
  const { game, weather } = bundle;
  return (
    <div className="gv-gw-matchup-hero" data-testid="gw-matchup-hero">
      <img
        src={ufLogoUrl()}
        alt="Florida Gators"
        className="gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--uf"
        width={80}
        height={80}
      />
      <div className="gv-gw-matchup-hero__center">
        <p className="gv-gw-matchup-hero__kicker">Game Week Matchup</p>
        <h2 className="gv-gw-matchup-hero__title">Florida vs {game.opp}</h2>
        <p className="gv-gw-matchup-hero__meta">{game.date}</p>
        <p className="gv-gw-matchup-hero__meta">{game.venue}</p>
        <div className="gv-gw-matchup-hero__badges">
          {game.tv ? <span className="gv-gw-matchup-hero__badge">{game.tv}</span> : null}
          <span className="gv-gw-matchup-hero__badge">{game.venue.split(',')[0]}</span>
          {weather ? <span className="gv-gw-matchup-hero__badge">{weather}</span> : null}
        </div>
      </div>
      <div className="gv-gw-matchup-hero__right">
        <img
          src={opponentLogoUrl(game.id)}
          alt={game.opp}
          className="gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--opp"
          width={80}
          height={80}
        />
        <CountdownWidget dateStr={game.date} />
      </div>
    </div>
  );
}
