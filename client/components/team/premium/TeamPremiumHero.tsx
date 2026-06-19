'use client';

import React from 'react';
import type { TeamHeroMetric } from './team-premium-types';

type Props = {
  metrics: TeamHeroMetric[];
  loading?: boolean;
};

export function TeamPremiumHero({ metrics, loading }: Props): React.ReactElement {
  return (
    <header className="team-premium-hero team-bleed" data-testid="team-premium-hero">
      <div className="team-premium-hero__bg" aria-hidden="true" />
      <div className="rh-frame team-premium-hero__inner">
        <div className="team-premium-hero__copy">
          <p className="team-premium-hero__eyebrow">Florida Gators Football</p>
          <h1 className="team-premium-hero__title">Team Command Center</h1>
          <p className="team-premium-hero__sub">
            Roster • Identity • Program History • Staff • Analytics
          </p>
        </div>
        <div className="team-premium-hero__metrics" aria-label="Team command metrics">
          {(loading ? Array.from({ length: 6 }, (_, i) => ({ id: `sk-${i}`, label: '—', value: '—' })) : metrics).map(
            (m) => (
              <div key={m.id} className="team-premium-hero__metric">
                <span className="team-premium-hero__metric-value">{m.value}</span>
                <span className="team-premium-hero__metric-label">{m.label}</span>
              </div>
            )
          )}
        </div>
      </div>
      <div className="team-premium-hero__underline" aria-hidden="true" />
    </header>
  );
}
