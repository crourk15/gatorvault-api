'use client';

import React from 'react';
import type { Coach } from '@/lib/team-hub-types';

type Props = {
  coach: Coach;
  onSelect: (coach: Coach) => void;
};

const SPECIALTY_MAP: Record<string, string> = {
  'Head Coach': 'Culture & Program Building',
  'Offensive Coordinator': 'Explosive Offense',
  'Defensive Coordinator': '3-3-5 / DBU',
  'Quarterbacks Coach': 'QB Development',
  'Running Backs Coach': 'RB Pipeline',
  'Offensive Line Coach': 'OL Development',
  'Defensive Line Coach': 'Trench Dominance',
  'Linebackers Coach': 'LB Athleticism',
  'Cornerbacks Coach': 'DBU',
  'Safeties Coach': 'DBU',
  'Special Teams Coordinator': 'Special Teams',
};

const REGION_MAP: Record<string, string[]> = {
  sumrall: ['FL', 'GA', 'AL', 'TX'],
  faulkner: ['FL', 'GA', 'TX'],
  white: ['FL', 'GA', 'AL'],
  craddock: ['FL', 'GA', 'TX', 'AL'],
  foster: ['FL', 'GA'],
  mcknight: ['FL', 'GA', 'TX'],
  davis: ['FL', 'GA', 'AL'],
  harris: ['FL', 'GA', 'TX'],
  collins: ['FL', 'GA', 'AL'],
};

function coachSpecialty(coach: Coach): string {
  return SPECIALTY_MAP[coach.title] ?? 'Player Development';
}

function coachRegions(coach: Coach): string[] {
  return REGION_MAP[coach.id] ?? ['FL', 'GA'];
}

function coachTenure(coach: Coach): string {
  return coach.id === 'sumrall' ? '2026–Present' : '2026–Present';
}

function coachKeyRecruits(coach: Coach): string[] {
  if (coach.title.includes('Head Coach')) return ['Jayden Woods', 'Marcus Johnson'];
  if (coach.title.includes('Defensive')) return ['Jayden Woods', 'Brandon Harris'];
  if (coach.title.includes('Offensive') || coach.title.includes('Quarterback')) return ['Caleb Rivers', 'Tyler Brooks'];
  return ['In-state pipeline'];
}

export function StaffCard({ coach, onSelect }: Props): React.ReactElement {
  return (
    <button type="button" className="team-staff-card" onClick={() => onSelect(coach)}>
      <div className="team-staff-card__headshot" aria-hidden="true">
        <span className="team-staff-card__initials">{coach.initials}</span>
      </div>
      <div className="team-staff-card__body">
        <h3 className="team-staff-card__name">{coach.name}</h3>
        <p className="team-staff-card__title">{coach.title}</p>
        <dl className="team-staff-card__meta">
          <div>
            <dt>Regions</dt>
            <dd>{coachRegions(coach).join(', ')}</dd>
          </div>
          <div>
            <dt>Key Recruits</dt>
            <dd>{coachKeyRecruits(coach).join(', ')}</dd>
          </div>
          <div>
            <dt>Tenure</dt>
            <dd>{coachTenure(coach)}</dd>
          </div>
          <div>
            <dt>Specialty</dt>
            <dd>{coachSpecialty(coach)}</dd>
          </div>
        </dl>
      </div>
    </button>
  );
}
