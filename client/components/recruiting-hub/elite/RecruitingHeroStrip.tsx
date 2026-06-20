'use client';

import React from 'react';

type Props = {
  classYear?: number;
};

export function RecruitingHeroStrip({ classYear = 2027 }: Props): React.ReactElement {
  return (
    <section className="rh-hero-strip" aria-label="Recruiting command center">
      <div className="rh-hero-main">
        <div className="rh-hero-title">Recruiting Command Center</div>
        <div className="rh-hero-subtitle">UF&apos;s class, movement, and battles—one place.</div>
      </div>
      <span className="rh-badge rh-hero-badge">{classYear} Focus</span>
    </section>
  );
}
