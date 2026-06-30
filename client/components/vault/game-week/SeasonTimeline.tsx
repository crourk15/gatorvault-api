'use client';

import React from 'react';
import {
  SCHEDULE_GAMES,
  getGameWeekBundle,
  isHomeGame,
  type GameWeekBundle,
} from '@/lib/game-week-data';
import { TeamLogo } from './TeamLogo';

type Props = {
  activeGameId: string;
  onSelect: (gameId: string) => void;
};

function diffClass(difficulty: GameWeekBundle['difficulty']): string {
  return `gv-gw-timeline__diff--${difficulty}`;
}

export function SeasonTimeline({ activeGameId, onSelect }: Props): React.ReactElement {
  return (
    <div className="gv-gw-wow-section">
      <h3 className="gv-gw-wow-section__title">Season timeline</h3>
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
              <TeamLogo teamId={g.id} variant="opponent" size={36} label="" className="gv-gw-timeline__logo" />
              <p className="gv-gw-timeline__label">{g.label}</p>
              <p className="gv-gw-timeline__date">{g.date.split('·')[0]?.trim()}</p>
              <span className={`gv-gw-timeline__ha gv-gw-timeline__ha--${home ? 'home' : 'away'}`}>
                {home ? 'HOME' : 'AWAY'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
