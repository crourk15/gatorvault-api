'use client';

import React from 'react';
import { TeamHeroMetricsSkeleton } from './TeamPageSkeleton';
import type { TeamHeroMetric } from './team-premium-types';

type Props = {
  metrics: TeamHeroMetric[];
  loading?: boolean;
};

export function TeamPremiumHero({ metrics, loading }: Props): React.ReactElement {
  const tiles = metrics.slice(0, 3);

  return (
    <section
      className="team-premium-hero rh-cc-hero team-premium-bleed"
      data-testid="team-premium-hero"
    >
      <div className="rh-cc-hero__bg team-premium-hero__bg" aria-hidden="true" />
      <span className="team-premium-hero__watermark" aria-hidden="true">
        FLORIDA
      </span>
      <div className="rh-frame rh-cc-hero__inner team-premium-hero__inner">
        <div className="team-premium-hero__copy">
          <p className="rh-cc-hero__eyebrow team-premium-hero__eyebrow">GatorVault · 2026</p>
          <h1 className="rh-cc-hero__title team-premium-hero__title">Florida Football</h1>
          <p className="rh-cc-hero__sub team-premium-hero__sub">
            Built in The Swamp — depth chart, roster rooms, and the recruiting pipeline in one hub.
          </p>
        </div>
        <div
          className="rh-cc-hero__metrics team-premium-hero__metrics"
          aria-label="Team scoreboard"
        >
          {loading || tiles.length === 0 ? (
            <TeamHeroMetricsSkeleton />
          ) : (
            tiles.map((m) => (
              <div key={m.id} className="rh-cc-hero__metric team-premium-hero__metric">
                <span className="rh-cc-hero__metric-value team-premium-hero__metric-value">
                  {m.value}
                </span>
                <span className="rh-cc-hero__metric-label team-premium-hero__metric-label">
                  {m.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="team-premium-hero__accent" aria-hidden="true" />
    </section>
  );
}
