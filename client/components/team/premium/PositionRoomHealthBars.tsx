'use client';

import React from 'react';
import type { PositionRoomHealth } from './team-premium-types';

type Props = {
  rooms: PositionRoomHealth[];
};

export function PositionRoomHealthBars({ rooms }: Props): React.ReactElement {
  return (
    <div className="team-room-health-grid">
      {rooms.map((room) => {
        const max = room.max ?? 100;
        const pct = Math.min(100, Math.round((room.score / max) * 100));
        return (
          <article key={room.id} className={`team-room-health-card team-room-health-card--${room.status}`}>
            <div className="team-room-health-card__head">
              <span className="team-room-health-card__label">{room.label}</span>
              <span className="team-room-health-card__score">{room.score}</span>
            </div>
            <div className="team-room-health-card__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <span className="team-room-health-card__fill" style={{ width: `${pct}%` }} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
