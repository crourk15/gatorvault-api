'use client';

import React from 'react';
import type { Achievement } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

type Props = {
  achievements: Achievement[];
};

export function ProgramAchievementsStats({ achievements }: Props): React.ReactElement {
  return (
    <section className="gv-team-hub__section gv-team-hub__frame" aria-label="Program achievements">
      <h2 className="gv-team-hub__section-title">{TEAM_COPY.achievements.title}</h2>
      <div className="gv-team-ach-grid">
        {achievements.map((item) => (
          <div key={item.id} className="gv-team-ach-card">
            <p className="gv-team-ach-card__value">{item.value}</p>
            <p className="gv-team-ach-card__label">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
