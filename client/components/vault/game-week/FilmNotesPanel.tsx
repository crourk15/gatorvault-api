'use client';

import React from 'react';

type Props = {
  notes: string[];
};

export function FilmNotesPanel({ notes }: Props): React.ReactElement {
  return (
    <div className="gv-gw-film-panel" data-testid="gw-film-notes">
      <ul className="gv-gw-film-panel__list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
