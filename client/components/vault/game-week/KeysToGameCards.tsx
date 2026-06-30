'use client';

import React from 'react';
import type { GameKeyIntel } from '@/lib/game-week-data';

type Props = {
  keys: GameKeyIntel[];
};

export function KeysToGameCards({ keys }: Props): React.ReactElement {
  return (
    <div className="gv-gw-flip-grid" data-testid="gw-keys-cards">
      {keys.map((k) => (
        <div key={k.id} className="gv-gw-flip-card">
          <div className="gv-gw-flip-card__inner">
            <div className="gv-gw-flip-card__face gv-gw-flip-card__face--front">
              <p className="gv-gw-flip-card__title">{k.title}</p>
            </div>
            <div className="gv-gw-flip-card__face gv-gw-flip-card__face--back">
              <p>{k.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
