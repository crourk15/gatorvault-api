'use client';

import React from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import { playerProfilePath } from '@/lib/player-routes';
import { isFutureCastInsider } from '@/lib/futurecast-insider';

type Props = {
  players: FutureCastPlayer[];
  limit?: number;
};

export function HighPriorityList({ players, limit }: Props): React.ReactElement {
  const insider = isFutureCastInsider();
  const list = limit && !insider ? players.slice(0, limit) : players;

  return (
    <section className="gv-card gv-fade-in" data-testid="fc-high-priority">
      <div className="gv-section-head">
        <h2 className="gv-card-title" style={{ margin: 0 }}>
          High Priority Targets
        </h2>
        <a href="/vault/recruiting" className="gv-section-link">
          Recruiting Hub →
        </a>
      </div>
      <ul className="gv-priority-list">
        {list.map((p) => (
          <li key={p.id} className="gv-priority-item">
            <a
              href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
              className="gv-priority-link"
            >
              <span className="gv-priority-name">{p.name}</span>
              <span className="gv-priority-meta">
                {p.position}
                {p.school ? ` · ${p.school}` : ''}
              </span>
              {insider ? (
                <span className="gv-priority-meta">
                  UF {p.ufConfidence.toFixed(0)}% · Fit {p.fitScore}
                </span>
              ) : null}
            </a>
          </li>
        ))}
        {list.length === 0 ? <li className="gv-empty">No high-priority targets loaded.</li> : null}
      </ul>
    </section>
  );
}
