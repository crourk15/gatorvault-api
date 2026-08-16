'use client';

import React from 'react';
import type { GameKeyIntel } from '@/lib/game-week-data';

type Props = {
  keys: GameKeyIntel[];
};

/**
 * Game Week keys — title + body always visible.
 * Hover-flip hid the Expected visitors list on mobile/touch (no hover).
 */
export function KeysToGameCards({ keys }: Props): React.ReactElement {
  return (
    <div className="gv-gw-flip-grid" data-testid="gw-keys-cards">
      {keys.map((k) => (
        <div
          key={k.id}
          className={`gv-gw-flip-card gv-gw-key-card${
            /expected visitors/i.test(k.title) ? ' gv-gw-key-card--visitors' : ''
          }`}
        >
          <p className="gv-gw-flip-card__title">{k.title}</p>
          {k.body ? <p className="gv-gw-key-card__body">{k.body}</p> : null}
        </div>
      ))}
    </div>
  );
}
