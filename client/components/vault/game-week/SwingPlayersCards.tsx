'use client';

import React from 'react';
import { headshotUrl, type SwingPlayerIntel } from '@/lib/game-week-data';

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
          <img
            src={headshotUrl(p.slug)}
            alt={p.name}
            className="gv-gw-swing-card__headshot"
            width={48}
            height={48}
          />
          <div>
            <span className="gv-gw-swing-card__pos">{p.position}</span>
            <strong>{p.name}</strong>
            <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: '#9CA3AF' }}>{p.role}</p>
            <div className="gv-gw-swing-card__bar">
              <div className="gv-gw-swing-card__bar-fill" style={{ width: `${p.impact}%` }} />
            </div>
            <span className={`gv-gw-swing-card__trend--${p.trend}`}>
              {trendArrow(p.trend)} Impact {p.impact}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
