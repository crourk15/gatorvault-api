'use client';

import React from 'react';
import type { Coach } from '@/lib/team-hub-types';

type Props = {
  coach: Coach;
  onSelect: (coach: Coach) => void;
};

/** Honest staff card — name + title only (no filler recruits / specialty cosplay). */
export function StaffCard({ coach, onSelect }: Props): React.ReactElement {
  return (
    <button type="button" className="team-staff-card" onClick={() => onSelect(coach)}>
      <div className="team-staff-card__headshot" aria-hidden="true">
        <span className="team-staff-card__initials">{coach.initials}</span>
      </div>
      <div className="team-staff-card__body">
        <h3 className="team-staff-card__name">{coach.name}</h3>
        <p className="team-staff-card__title">{coach.title}</p>
      </div>
    </button>
  );
}
