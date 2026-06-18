'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import {
  comfortZone,
  estimateNilValuation,
  marketTrend,
  positionBand,
  ufNilFitLabel,
} from './nil-player-utils';
import './nil-vertical-card.css';

type Props = {
  player: HighPriorityPlayer;
};

export function NILVerticalCard({ player }: Props): React.ReactElement {
  const comfort = comfortZone(player);
  const valuation = estimateNilValuation(player);

  return (
    <article className="rh-nil-card rh-elite-data-card rh-elite-data-card--nil hp-intel-card hp-intel-card--nil" data-testid="rh-nil-vertical-card">
      <header className="rh-nil-card__header">
        <PlayerNavLink href={playerProfileRoute(player.slug, 'futurecast')} className="rh-nil-card__identity">
          <span className="rh-nil-card__name">{player.name}</span>
          <span className="rh-nil-card__meta">{player.position}</span>
        </PlayerNavLink>
        <span className="rh-nil-card__valuation">{valuation}</span>
      </header>

      <section className="rh-nil-card__block">
        <h4 className="rh-nil-card__label">On3 NIL estimate</h4>
        <p className="rh-nil-card__value">{valuation}</p>
      </section>

      <section className="rh-nil-card__metrics">
        <div className="rh-nil-card__metric">
          <span className="rh-nil-card__label">UF NIL fit</span>
          <span className="rh-nil-card__value">{ufNilFitLabel(player)}</span>
        </div>
        <div className="rh-nil-card__metric">
          <span className="rh-nil-card__label">Market trend</span>
          <span className="rh-nil-card__value">{marketTrend(player)}</span>
        </div>
        <div className="rh-nil-card__metric">
          <span className="rh-nil-card__label">Position market</span>
          <span className="rh-nil-card__value">{positionBand(player)}</span>
        </div>
      </section>

      <section className="rh-nil-card__block">
        <span className={`rh-nil-card__comfort rh-nil-card__comfort--${comfort.level}`}>{comfort.label}</span>
      </section>

      <footer className="rh-nil-card__footer">
        <PlayerNavLink href={playerProfileRoute(player.slug, 'futurecast')} className="hp-intel-btn hp-intel-btn--primary">
          View profile
        </PlayerNavLink>
      </footer>
    </article>
  );
}
