'use client';

import React from 'react';
import type { Coach } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';
import { TeamPremiumModule } from './TeamPremiumModule';
import { StaffCard } from './StaffCard';

type Props = {
  coaches: Coach[];
  onSelectCoach: (coach: Coach) => void;
};

export function StaffCardGrid({ coaches, onSelectCoach }: Props): React.ReactElement {
  const coaching = coaches.filter((c) => c.group === 'coaching');
  const support = coaches.filter((c) => c.group === 'support');

  return (
    <div className="team-premium-section" id="coaching-staff" data-section="coaching-staff">
      <TeamPremiumModule
        title={TEAM_COPY.coachingStaff.title}
        subtitle={TEAM_COPY.coachingStaff.subtitle}
      >
        <div className="team-staff-grid">
          {coaching.map((coach) => (
            <StaffCard key={coach.id} coach={coach} onSelect={onSelectCoach} />
          ))}
        </div>

        {support.length > 0 ? (
          <div className="team-staff-support">
            <h3 className="team-staff-support__title">{TEAM_COPY.coachingStaff.supportTitle}</h3>
            <div className="team-staff-support__list">
              {support.map((member) => (
                <div key={member.id} className="team-staff-support__row">
                  <strong>{member.title}</strong> — {member.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </TeamPremiumModule>
    </div>
  );
}
