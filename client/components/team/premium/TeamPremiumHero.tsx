'use client';

import React from 'react';
import { TeamHeroMetricsSkeleton } from './TeamPageSkeleton';
import type { TeamHeroMetric } from './team-premium-types';

type Props = {
  pulse: TeamHeroMetric | null;
  loading?: boolean;
};

export function TeamPremiumHero({ pulse, loading }: Props): React.ReactElement {
  return (
    <section
      className="rh-elite-desktop-only team-premium-hero rh-cc-hero team-premium-bleed"
      data-testid="team-premium-hero"
    >
      <div className="rh-cc-hero__bg team-premium-hero__bg" aria-hidden="true" />
      <div className="rh-frame rh-cc-hero__inner team-premium-hero__inner">
        <div className="team-premium-hero__copy">
          <p className="rh-cc-hero__eyebrow team-premium-hero__eyebrow">Florida Gators Football</p>
          <h1 className="rh-cc-hero__title team-premium-hero__title">Florida Football</h1>
          <p className="rh-cc-hero__sub team-premium-hero__sub">
            Depth chart, roster, and recruiting pipeline — how the Gators are built.
          </p>
        </div>
        <div className="rh-cc-hero__metrics team-premium-hero__metrics team-premium-hero__metrics--pulse" aria-label="Team pulse">
          {loading || !pulse ? (
            <TeamHeroMetricsSkeleton />
          ) : (
            <div className="rh-cc-hero__metric team-premium-hero__metric team-premium-hero__metric--pulse">
              <span className="rh-cc-hero__metric-value team-premium-hero__metric-value">{pulse.value}</span>
              <span className="rh-cc-hero__metric-label team-premium-hero__metric-label">{pulse.label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="team-premium-hero__accent" aria-hidden="true" />
    </section>
  );
}
