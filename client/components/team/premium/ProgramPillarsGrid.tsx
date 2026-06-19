'use client';

import React from 'react';

type Pillar = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

const PILLARS: Pillar[] = [
  { id: 'defense', title: 'Relentless Defense', description: '3-3-5 pressure, DBU tradition, and trench-first identity.', icon: '🛡️' },
  { id: 'offense', title: 'Explosive Offense', description: 'Spread concepts, vertical passing, and playmaker development.', icon: '⚡' },
  { id: 'dev', title: 'Player Development Pipeline', description: 'NFL-level S&C, position mastery, and year-over-year growth.', icon: '📈' },
  { id: 'recruit', title: 'Florida Recruiting Footprint', description: 'In-state dominance plus SEC and national pipeline expansion.', icon: '🗺️' },
  { id: 'nil', title: 'NIL + Portal Strategy', description: 'Modern roster construction with competitive NIL and portal intel.', icon: '💰' },
  { id: 'swamp', title: 'The Swamp Advantage', description: 'Home-field intimidation — noise, heat, and Gator Nation energy.', icon: '🐊' },
];

type CardProps = {
  pillar: Pillar;
};

export function ProgramPillarCard({ pillar }: CardProps): React.ReactElement {
  return (
    <article className="team-pillar-card">
      <span className="team-pillar-card__icon" aria-hidden="true">{pillar.icon}</span>
      <h4 className="team-pillar-card__title">{pillar.title}</h4>
      <p className="team-pillar-card__desc">{pillar.description}</p>
    </article>
  );
}

export function ProgramPillarsGrid(): React.ReactElement {
  return (
    <div className="team-pillars-grid">
      {PILLARS.map((p) => (
        <ProgramPillarCard key={p.id} pillar={p} />
      ))}
    </div>
  );
}
