'use client';

import React from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import { playerProfilePath } from '@/lib/player-routes';
import { isFutureCastInsider } from '@/lib/futurecast-insider';

type Props = {
  player: FutureCastPlayer;
  direction: 'up' | 'down';
};

export function TrendingPlayerCard({ player, direction }: Props): React.ReactElement {
  const insider = isFutureCastInsider();
  const isUp = direction === 'up';
  const icon = isUp ? '/icons/trending-up.svg' : '/icons/trending-down.svg';

  return (
    <article className="gv-card gv-trending-card gv-fade-in" data-testid="fc-trending-card">
      <a
        href={playerProfilePath(player.slug, 'HIGH_SCHOOL', true, player.name, 'futurecast')}
        className="gv-trending-card__link"
      >
        <div className="gv-trending-header">
          <div>
            <h3 className="gv-trending-name">{player.name}</h3>
            <p className="gv-trending-pos">
              {player.position}
              {player.school ? ` · ${player.school}` : ''}
            </p>
          </div>
          <img src={icon} alt={isUp ? 'Trending up' : 'Trending down'} width={20} height={20} />
        </div>
        <div className="gv-trending-ranks">
          <span>{player.composite > 0 ? `${player.composite.toFixed(2)} comp` : '— comp'}</span>
          {player.natlRank != null ? <span>#{player.natlRank} NATL</span> : null}
          {player.posRank != null ? <span>#{player.posRank} POS</span> : null}
          {player.stateRank != null ? <span>#{player.stateRank} ST</span> : null}
        </div>
        <div className={`gv-trending-metrics${!insider ? ' gv-insider-blur' : ''}`}>
          <span>UF {insider ? `${player.ufConfidence.toFixed(0)}%` : '—%'}</span>
          <span className="gv-fit-badge">Fit {insider ? player.fitScore : '—'}</span>
          <span>
            {insider
              ? `${player.trendDelta7d > 0 ? '+' : ''}${player.trendDelta7d.toFixed(2)}`
              : '—'}
          </span>
        </div>
        {insider ? (
          <div className="gv-trending-bar" aria-hidden="true">
            <div
              className="gv-trending-bar-fill"
              style={{ width: `${Math.min(100, player.ufConfidence)}%` }}
            />
          </div>
        ) : null}
      </a>
    </article>
  );
}
