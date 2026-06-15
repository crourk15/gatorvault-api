'use client';

import React from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import { playerProfilePath } from '@/lib/player-routes';

function MiniList({
  title,
  tone,
  players,
}: {
  title: string;
  tone: 'up' | 'down' | 'volatile';
  players: FutureCastPlayer[];
}): React.ReactElement {
  return (
    <div className={`gv-summary-col gv-summary-col--${tone}`}>
      <h3 className="gv-summary-title">{title}</h3>
      <ul className="gv-summary-list">
        {players.slice(0, 6).map((p) => (
          <li key={p.id}>
            <a
              href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
              className="gv-summary-link"
            >
              {p.name}
              <span>
                {p.trendDelta7d > 0 ? '+' : ''}
                {p.trendDelta7d.toFixed(2)}
              </span>
            </a>
          </li>
        ))}
        {players.length === 0 ? <li className="gv-empty">None in window.</li> : null}
      </ul>
    </div>
  );
}

type Props = {
  risers: FutureCastPlayer[];
  fallers: FutureCastPlayer[];
  volatile: FutureCastPlayer[];
};

export function MovementSummary({ risers, fallers, volatile }: Props): React.ReactElement {
  return (
    <section className="gv-card gv-fade-in" data-testid="fc-movement-summary">
      <h2 className="gv-card-title">Movement Summary</h2>
      <div className="gv-summary-grid">
        <MiniList title="Top Risers" tone="up" players={risers} />
        <MiniList title="Top Fallers" tone="down" players={fallers} />
        <MiniList title="High Volatility" tone="volatile" players={volatile} />
      </div>
    </section>
  );
}
