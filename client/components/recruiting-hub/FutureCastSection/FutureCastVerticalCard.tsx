'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import {
  analystConfidence,
  competingSchools,
  lastIntel,
  movementDelta,
  ufPct,
} from './futurecast-player-utils';
import './futurecast-vertical-card.css';

type Props = {
  player: HighPriorityPlayer;
};

function MovementBadge({ delta }: { delta: number }): React.ReactElement {
  if (delta > 0) {
    return (
      <span className="rh-fc-card__badge rh-fc-card__badge--up">
        ↑ +{Math.abs(delta)}% (7d)
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="rh-fc-card__badge rh-fc-card__badge--down">
        ↓ {delta}% (7d)
      </span>
    );
  }
  return <span className="rh-fc-card__badge rh-fc-card__badge--flat">±0% (7d)</span>;
}

export function FutureCastVerticalCard({ player }: Props): React.ReactElement {
  const prob = ufPct(player);
  const delta = movementDelta(player);
  const intel = lastIntel(player);
  const schools = competingSchools(player);
  const confidence = analystConfidence(player);
  const fit = player.fitScore != null ? Math.round(player.fitScore) : null;

  return (
    <article className="rh-fc-card rh-elite-data-card rh-elite-data-card--rpm hp-intel-card hp-intel-card--rpm" data-testid="rh-fc-vertical-card">
      <header className="rh-fc-card__header">
        <PlayerNavLink href={playerProfileRoute(player.slug, 'futurecast')} className="rh-fc-card__identity">
          <span className="rh-fc-card__name">{player.name}</span>
          <span className="rh-fc-card__meta">
            {player.position}
            {player.school ? ` · ${player.school}` : ''}
          </span>
        </PlayerNavLink>
        {fit != null ? <span className="rh-fc-card__fit">Fit {fit}</span> : null}
      </header>

      <section className="hp-intel-prob rh-fc-card__prob">
        <div className="hp-intel-prob-main">
          <span className="hp-intel-prob-value">{prob}%</span>
          <span className="hp-intel-prob-caption">UF Probability</span>
        </div>
        <div className="hp-intel-prob-bar" role="img" aria-label={`UF probability ${prob} percent`}>
          <div className="hp-intel-prob-fill" style={{ width: `${prob}%` }} />
        </div>
        <div className="hp-intel-prob-delta">
          <MovementBadge delta={delta} />
        </div>
      </section>

      <section className="rh-fc-card__block">
        <h4 className="rh-fc-card__label">Competing schools</h4>
        <p className="rh-fc-card__value">{schools}</p>
      </section>

      <section className="rh-fc-card__block">
        <h4 className="rh-fc-card__label">🎯 Analyst confidence</h4>
        {confidence != null ? (
          <p className="rh-fc-card__confidence">
            <span className="rh-fc-card__confidence-value">{confidence}%</span>
            {player.predictors?.[0]?.name ? (
              <span className="rh-fc-card__confidence-src"> · {player.predictors[0].name}</span>
            ) : null}
          </p>
        ) : null}
        <p className="hp-intel-summary-text rh-fc-card__intel">{intel}</p>
      </section>

      <footer className="rh-fc-card__footer">
        <PlayerNavLink href={playerProfileRoute(player.slug, 'futurecast')} className="hp-intel-btn hp-intel-btn--primary">
          FutureCast
        </PlayerNavLink>
      </footer>
    </article>
  );
}
