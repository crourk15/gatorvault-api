'use client';

import React from 'react';
import { QUICK_ACTIONS } from '@/components/home/home-utils';
import { HomeModuleCard } from '@/components/home/HomeModuleCard';
import './HomeCTASection.css';

export function HomeCTASection(): React.ReactElement {
  return (
    <HomeModuleCard
      gridClass="gv-home__cell--12"
      eyebrow="Explore"
      title="Explore the Vault"
      subtitle="Jump straight into recruiting, film, NIL, and game-week prep."
      ariaLabel="Quick links"
      testId="home-cta-strip"
      className="gv-home-cta"
    >
      <div className="gv-home-cta__grid">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-home-cta__tile gv-home-card">
            <span className="gv-home-cta__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="gv-home-card__title gv-home-cta__label">{action.label}</span>
            <span className="gv-home-card__meta gv-home-cta__desc">{action.desc}</span>
          </a>
        ))}
      </div>
    </HomeModuleCard>
  );
}
