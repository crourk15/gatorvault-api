'use client';

import React from 'react';
import { QUICK_ACTIONS } from '@/components/home/home-utils';
import './HomeCTASection.css';

export function HomeCTASection(): React.ReactElement {
  return (
    <section className="gv-home__cell gv-home__cell--12 gv-home-cta" aria-label="Quick links" data-testid="home-cta-strip">
      <h2 className="gv-home-cta__title">Explore the Vault</h2>
      <p className="gv-home-cta__subtitle">Jump straight into recruiting, film, NIL, and game-week prep.</p>
      <div className="gv-home-cta__grid">
        {QUICK_ACTIONS.map((action) => (
          <a key={action.href} href={action.href} className="gv-home-cta__tile">
            <span className="gv-home-cta__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="gv-home-cta__label">{action.label}</span>
            <span className="gv-home-cta__desc">{action.desc}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
