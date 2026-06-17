'use client';

import React from 'react';
import type { Era } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

type Props = {
  eras: Era[];
  onSelectEra: (era: Era) => void;
};

export function ProgramHistoryTimeline({ eras, onSelectEra }: Props): React.ReactElement {
  return (
    <section
      className="gv-team__cell gv-team__cell--12 gv-team-card gv-team-section"
      id="program-history"
      aria-label="Program history"
    >
      <h2 className="gv-team-card__title">{TEAM_COPY.programHistory.title}</h2>
      <div className="gv-team-timeline" role="list">
        {eras.map((era) => (
          <button
            key={era.id}
            type="button"
            className="gv-team-era-card"
            role="listitem"
            onClick={() => onSelectEra(era)}
          >
            <p className="gv-team-era-card__label">{era.label}</p>
            <h3 className="gv-team-era-card__title">{era.title}</h3>
          </button>
        ))}
      </div>
    </section>
  );
}
