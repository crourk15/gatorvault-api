'use client';

import React from 'react';
import type { GameWeekBundle } from '@/lib/game-week-data';
import { homeLogoUrl, awayLogoUrl } from '@/lib/team-logos';
import { buildUfUniformChips } from '@/lib/uf-uniform-colors';
import { CountdownWidget } from './CountdownWidget';

type Props = {
  bundle: GameWeekBundle;
};

export function MatchupHeroWidget({ bundle }: Props): React.ReactElement {
  const { game, weather } = bundle;
  const weatherParts = weather?.split(' · ') ?? [];
  const uniformChips = buildUfUniformChips(game.uniform);

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
        {uniformChips.length > 0 ? (
          <div className="gv-gw-matchup-hero__uniform" data-testid="gw-uniform">
            <span className="gv-gw-matchup-hero__uniform-label">This week</span>
            <div className="gv-gw-matchup-hero__uniform-chips" role="list">
              {uniformChips.map((chip) => (
                <div
                  key={chip.part}
                  className="gv-gw-uniform-chip"
                  role="listitem"
                  title={`${chip.partLabel}: ${chip.swatch.label}`}
                >
                  <span className="gv-gw-uniform-chip__part">{chip.partLabel}</span>
                  <span
                    className={`gv-gw-uniform-chip__swatch gv-gw-uniform-chip__swatch--${chip.swatch.label.toLowerCase()}`}
                    style={{
                      background: chip.swatch.background,
                      color: chip.swatch.color,
                      borderColor: chip.swatch.border,
                    }}
                  >
                    {chip.swatch.label}
                  </span>
                </div>
              ))}
            </div>
            {game.uniform?.note ? (
              <span className="gv-gw-matchup-hero__uniform-note">{game.uniform.note}</span>
            ) : null}
          </div>
        ) : game.uniform?.label ? (
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
