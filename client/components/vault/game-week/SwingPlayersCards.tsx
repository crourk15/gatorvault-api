'use client';

import React from 'react';
import type { SwingPlayerIntel } from '@/lib/game-week-data';
import { SwingPlayerAvatar } from './SwingPlayerAvatar';

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
          <SwingPlayerAvatar
            slug={p.slug}
            name={p.name}
            position={p.position}
            impact={p.impact}
            size="md"
          />
          <div className="gv-gw-swing-card__body">
            <div className="gv-gw-swing-card__head">
              <span className="gv-gw-swing-card__name">{p.name}</span>
              <span className="gv-gw-swing-card__pos">{p.position}</span>
            </div>
            <div className="gv-gw-swing-card__impact-row">
              <span className="gv-gw-swing-card__impact-label">Impact</span>
              <span className="gv-gw-swing-card__impact">{p.impact}</span>
              <span className={`gv-gw-swing-card__trend gv-gw-swing-card__trend--${p.trend}`}>
                {trendArrow(p.trend)}
              </span>
            </div>
            <p className="gv-gw-swing-card__role">{p.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
