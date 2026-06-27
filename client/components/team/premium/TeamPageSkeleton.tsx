'use client';

import React from 'react';

export function TeamRosterSkeleton({ count = 8 }: { count?: number }): React.ReactElement {
  return (
    <div
      className="team-premium-skeleton team-premium-skeleton--roster"
      aria-hidden="true"
      data-testid="team-roster-skeleton"
    >
      <div className="team-premium-skeleton__filters">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="team-premium-skeleton__pill" />
        ))}
      </div>
      <div className="gv-team-roster-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="team-premium-skeleton__card" />
        ))}
      </div>
    </div>
  );
}

export function TeamHeroMetricsSkeleton(): React.ReactElement {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rh-cc-hero__metric team-premium-hero__metric team-premium-skeleton__metric"
        >
          <span className="team-premium-skeleton__line team-premium-skeleton__line--value" />
          <span className="team-premium-skeleton__line team-premium-skeleton__line--label" />
        </div>
      ))}
    </>
  );
}

export function TeamPipelineSkeleton(): React.ReactElement {
  return (
    <div
      className="team-premium-skeleton team-premium-skeleton--pipeline"
      aria-hidden="true"
      data-testid="team-pipeline-skeleton"
    >
      <div className="team-premium-skeleton__row team-premium-skeleton__row--wide" />
      <div className="team-premium-skeleton__grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="team-premium-skeleton__block" />
        ))}
      </div>
    </div>
  );
}

export function TeamOverviewSkeleton(): React.ReactElement {
  return (
    <div className="team-premium-skeleton team-premium-skeleton--overview" aria-hidden="true" data-testid="team-overview-skeleton">
      <div className="team-premium-skeleton__grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="team-premium-skeleton__block team-premium-skeleton__block--tall" />
        ))}
      </div>
      <div className="team-premium-skeleton__row team-premium-skeleton__row--wide" />
      <div className="team-premium-skeleton__row" />
    </div>
  );
}

export function TeamDepthChartSkeleton(): React.ReactElement {
  return (
    <div className="team-premium-skeleton team-premium-skeleton--depth" aria-hidden="true" data-testid="team-depth-skeleton">
      <div className="team-premium-skeleton__filters">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="team-premium-skeleton__pill" />
        ))}
      </div>
      <div className="team-premium-skeleton__grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="team-premium-skeleton__card" />
        ))}
      </div>
    </div>
  );
}
