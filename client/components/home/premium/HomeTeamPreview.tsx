'use client';

import React from 'react';
import type { TeamHubBundle } from '@/lib/team-hub-api';
import { computeHeroMetrics } from '@/components/team/premium/team-premium-metrics';

type Props = {
  bundle: TeamHubBundle | null;
  loading?: boolean;
};

/** Home teaser — honest roster / depth stats only. */
export function HomeTeamPreview({ bundle, loading }: Props): React.ReactElement {
  if (loading || !bundle) {
    return (
      <div className="uf-premium-grid uf-premium-grid--4">
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  const hero = computeHeroMetrics(bundle);
  const metrics = [
    hero.find((m) => m.id === 'scholarships'),
    hero.find((m) => m.id === 'locked'),
    hero.find((m) => m.id === 'battles'),
    hero.find((m) => m.id === 'portal-add'),
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="uf-premium-grid uf-premium-grid--4" data-testid="home-team-preview">
      {metrics.map((m) => (
        <article key={m.label} className="uf-premium-card uf-premium-metric">
          <span className="uf-premium-metric__label">{m.label}</span>
          <span className="uf-premium-metric__value">{m.value}</span>
        </article>
      ))}
    </div>
  );
}
