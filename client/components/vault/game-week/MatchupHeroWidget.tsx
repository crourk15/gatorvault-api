'use client';

import React from 'react';
import type { GameWeekBundle } from '@/lib/game-week-data';
import { homeLogoUrl, awayLogoUrl } from '@/lib/team-logos';
import { CountdownWidget } from './CountdownWidget';

type Props = {
  bundle: GameWeekBundle;
};

export function MatchupHeroWidget({ bundle }: Props): React.ReactElement {
  const { game, weather } = bundle;
  const weatherParts = weather?.split(' · ') ?? [];

  return (
    <div className="gv-gw-matchup-hero" data-testid="gw-matchup-hero">
      <div className="gv-gw-matchup-hero__left">
        <img
          src={homeLogoUrl()}
          alt="Florida Gators"
          className="gv-gw-team-logo-img gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--uf"
          width={56}
          height={56}
        />
        <span className="gv-gw-matchup-hero__vs" aria-hidden="true">
          vs
        </span>
        <img
          src={awayLogoUrl(game.id)}
          alt={game.opp}
          className="gv-gw-team-logo-img gv-gw-matchup-hero__logo gv-gw-matchup-hero__logo--opp"
          width={56}
          height={56}
        />
      </div>
      <div className="gv-gw-matchup-hero__center">
        <h2 className="gv-gw-matchup-hero__title">Florida vs {game.opp}</h2>
        <p className="gv-gw-matchup-hero__meta">{game.date}</p>
        <p className="gv-gw-matchup-hero__meta">
          {game.venue}
          {game.tv ? ` · ${game.tv}` : ''}
        </p>
        {game.uniform?.label ? (
          <p className="gv-gw-matchup-hero__uniform" data-testid="gw-uniform">
            <span className="gv-gw-matchup-hero__uniform-label">Uniform</span>
            <span className="gv-gw-matchup-hero__uniform-combo">{game.uniform.label}</span>
            {game.uniform.note ? (
              <span className="gv-gw-matchup-hero__uniform-note">{game.uniform.note}</span>
            ) : null}
          </p>
        ) : null}
        {weather ? (
          <div className="gv-gw-matchup-hero__weather">
            {weatherParts.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="gv-gw-matchup-hero__right">
        <CountdownWidget dateStr={game.date} />
      </div>
    </div>
  );
}
