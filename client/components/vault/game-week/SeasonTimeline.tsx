'use client';

import React from 'react';
import {
  SCHEDULE_GAMES,
  getGameWeekBundle,
  isHomeGame,
  type GameWeekBundle,
} from '@/lib/game-week-data';
import { opponentLogoUrl } from '@/lib/team-logos';

type Props = {
  activeGameId: string;
  onSelect: (gameId: string) => void;
};

function diffClass(difficulty: GameWeekBundle['difficulty']): string {
  return `gv-gw-timeline__diff--${difficulty}`;
}

export function SeasonTimeline({ activeGameId, onSelect }: Props): React.ReactElement {
  return (
    <div className="gv-gw-timeline" data-testid="gw-season-timeline">
      {SCHEDULE_GAMES.map((g) => {
        const bundle = getGameWeekBundle(g.id);
        const home = isHomeGame(g);
        return (
          <button
            key={g.id}
            type="button"
            className={`gv-gw-timeline__card ${diffClass(bundle.difficulty)}${activeGameId === g.id ? ' is-active' : ''}`}
            onClick={() => onSelect(g.id)}
          >
            <img
              src={opponentLogoUrl(g.id)}
              alt=""
              className="gv-gw-timeline__logo"
              width={36}
              height={36}
            />
            <p className="gv-gw-timeline__label">{g.label}</p>
            <span className={`gv-gw-timeline__ha gv-gw-timeline__ha--${home ? 'home' : 'away'}`}>
              {home ? 'HOME' : 'AWAY'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
