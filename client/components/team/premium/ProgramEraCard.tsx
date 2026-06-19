'use client';

import React from 'react';
import type { Era } from '@/lib/team-hub-types';

type Props = {
  era: Era;
  onSelect: (era: Era) => void;
};

export function ProgramEraCard({ era, onSelect }: Props): React.ReactElement {
  return (
    <button type="button" className="team-era-card" onClick={() => onSelect(era)}>
      <span className="team-era-card__label">{era.label}</span>
      <h3 className="team-era-card__title">{era.title}</h3>
      {era.highlights && era.highlights.length > 0 ? (
        <ul className="team-era-card__list">
          {era.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}
