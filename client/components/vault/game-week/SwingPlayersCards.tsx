'use client';

import React from 'react';
import type { SwingPlayerIntel } from '@/lib/game-week-data';
import { PlayerHeadshot } from './PlayerHeadshot';

type Props = {
  players: SwingPlayerIntel[];
};

function trendArrow(trend: SwingPlayerIntel['trend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

export function SwingPlayersCards({ players }: Props): React.ReactElement {
  return (
    <div className="gv-gw-swing-grid" data-testid="gw-swing-cards">
      {players.map((p) => (
        <div key={p.slug + p.name} className="gv-gw-swing-card">
          <PlayerHeadshot slug={p.slug} name={p.name} size="md" />
          <div className="gv-gw-swing-card__body">
            <div className="gv-gw-swing-card__head">
              <strong className="gv-gw-swing-card__name">{p.name}</strong>
              <span className="gv-gw-swing-card__pos">{p.position}</span>
            </div>
            <p className="gv-gw-swing-card__role">{p.role}</p>
            <div className="gv-gw-swing-card__impact-row">
              <span className="gv-gw-swing-card__impact">Impact {p.impact}</span>
              <span className={`gv-gw-swing-card__trend gv-gw-swing-card__trend--${p.trend}`}>
                {trendArrow(p.trend)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
