'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { TEAM_COPY } from '@/lib/team-hub-types';

export function TeamHero(): React.ReactElement {
  return (
    <section
      className="gv-team-hero gv-texture-stadium-lights gv-texture-swamp-mist"
      aria-label="Florida Gators Football"
    >
      <div className="gv-team-hero__bg" aria-hidden="true" />
      <div className="gv-team-hero__inner gv-team-hub__frame">
        <GatorVaultWordmark height={28} className="gv-team-hero__wordmark" />
        <h1 className="gv-team-hero__title">{TEAM_COPY.hero.title}</h1>
        <p className="gv-team-hero__subtitle">{TEAM_COPY.hero.subtitle}</p>
        <p className="gv-team-hero__badge">{TEAM_COPY.hero.badge}</p>
      </div>
    </section>
  );
}
