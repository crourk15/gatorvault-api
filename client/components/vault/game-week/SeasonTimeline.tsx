'use client';

import React, { useEffect, useState } from 'react';
import {
  SCHEDULE_GAMES,
  getGameWeekBundle,
  isHomeGame,
  type GameWeekBundle,
} from '@/lib/game-week-data';
import { fetchScheduleGames } from '@/lib/schedule-api';
import type { ScheduleGame } from '@/lib/schedule-data';
import { opponentLogoUrl } from '@/lib/team-logos';

type Props = {
  activeGameId: string;
  onSelect: (gameId: string) => void;
};

function diffClass(difficulty: GameWeekBundle['difficulty']): string {
  return `gv-gw-timeline__diff--${difficulty}`;
}

export function SeasonTimeline({ activeGameId, onSelect }: Props): React.ReactElement {
  const [games, setGames] = useState<ScheduleGame[]>(SCHEDULE_GAMES);

  useEffect(() => {
    let cancelled = false;
    fetchScheduleGames(2026)
      .then((live) => {
        if (!cancelled && live.length) setGames(live);
      })
      .catch(() => {
        /* keep seed */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="gv-gw-wow-section">
      <h3 className="gv-gw-wow-section__title">Season timeline</h3>
      <div className="gv-gw-timeline" data-testid="gw-season-timeline">
        {games.map((g) => {
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
                className="gv-gw-team-logo-img gv-gw-timeline__logo"
                width={36}
                height={36}
              />
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
