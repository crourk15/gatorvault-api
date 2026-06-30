'use client';

import React from 'react';
import type { GameWeekBundle } from '@/lib/game-week-data';
import { TeamLogo } from './TeamLogo';
import { CountdownWidget } from './CountdownWidget';

type Props = {
  bundle: GameWeekBundle;
};

export function MatchupHeroWidget({ bundle }: Props): React.ReactElement {
  const { game, weather } = bundle;
  return (
    <div className="gv-gw-matchup-hero" data-testid="gw-matchup-hero">
      <div className="gv-gw-matchup-hero__logos">
        <TeamLogo variant="uf" teamId="uf" size={72} className="gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--uf" />
        <TeamLogo
          variant="opponent"
          teamId={game.id}
          size={72}
          label={game.opp}
          className="gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--opp"
        />
      </div>
      <div className="gv-gw-matchup-hero__center">
        <h2 className="gv-gw-matchup-hero__title">Florida vs {game.opp}</h2>
        <p className="gv-gw-matchup-hero__meta">{game.date}</p>
        <p className="gv-gw-matchup-hero__meta">
          {game.venue}
          {game.tv ? ` · ${game.tv}` : ''}
        </p>
        {weather ? (
          <div className="gv-gw-matchup-hero__weather">
            <span className="gv-gw-matchup-hero__weather-icon" aria-hidden="true">
              ☀
            </span>
            <span>{weather}</span>
          </div>
        ) : null}
      </div>
      <div className="gv-gw-matchup-hero__right">
        <CountdownWidget dateStr={game.date} />
      </div>
    </div>
  );
}
