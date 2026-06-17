'use client';

import React from 'react';
import type { Coach } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

type Props = {
  coaches: Coach[];
  onSelectCoach: (coach: Coach) => void;
};

export function CoachingStaffGrid({ coaches, onSelectCoach }: Props): React.ReactElement {
  const coaching = coaches.filter((c) => c.group === 'coaching');
  const support = coaches.filter((c) => c.group === 'support');

  return (
    <section
      className="gv-team__cell gv-team__cell--12 gv-team-card gv-team-section"
      id="coaching-staff"
      aria-label="Coaching staff"
    >
      <h2 className="gv-team-card__title">{TEAM_COPY.coachingStaff.title}</h2>
      <p className="gv-team-section__sub">{TEAM_COPY.coachingStaff.subtitle}</p>

      <div className="gv-team-staff-grid">
        {coaching.map((coach) => (
          <button
            key={coach.id}
            type="button"
            className="gv-team-staff-card"
            onClick={() => onSelectCoach(coach)}
          >
            <span className="gv-team-staff-card__initials" aria-hidden="true">
              {coach.initials}
            </span>
            <span>
              <p className="gv-team-staff-card__name">{coach.name}</p>
              <p className="gv-team-staff-card__title">{coach.title}</p>
            </span>
          </button>
        ))}
      </div>

      {support.length > 0 && (
        <>
          <h3 className="gv-team-card__title gv-team-section__subheading">
            {TEAM_COPY.coachingStaff.supportTitle}
          </h3>
          <div className="gv-team-support-list">
            {support.map((member) => (
              <div key={member.id} className="gv-team-support-row">
                <strong>{member.title}</strong> — {member.name}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
