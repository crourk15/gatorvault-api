'use client';

import React from 'react';
import type { ScheduleGame } from '@/lib/schedule-data';

type Props = {
  notes: string[];
  game: ScheduleGame;
};

export function FilmNotesPanel({ notes, game }: Props): React.ReactElement {
  const lessonHref = game.filmLessonId
    ? `/vault/film-room/?hub=Film%20Breakdown&lesson=${encodeURIComponent(game.filmLessonId)}`
    : '/vault/film-room/?hub=Opponent%20Prep';

  return (
    <div className="gv-gw-film-panel" data-testid="gw-film-notes">
      <ul className="gv-gw-film-panel__list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a href={lessonHref} className="gv-gw-film-panel__link">
        Opponent prep in Film Room →
      </a>
    </div>
  );
}
