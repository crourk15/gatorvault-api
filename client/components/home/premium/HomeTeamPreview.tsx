'use client';

import React from 'react';
import type { TeamHubBundle } from '@/lib/team-hub-api';
import {
  computeHeroMetrics,
  computePortalSnapshot,
  computeSnapshotMetrics,
} from '@/components/team/premium/team-premium-metrics';

type Props = {
  bundle: TeamHubBundle | null;
  loading?: boolean;
};

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
  const snapshot = computeSnapshotMetrics();
  const portal = computePortalSnapshot(bundle);

  const scholarship = hero.find((m) => m.id === 'scholarships')?.value ?? '—';
  const returning = snapshot.find((m) => m.id === 'returning')?.value ?? '—';
  const blueChip = snapshot.find((m) => m.id === 'bcr')?.value ?? '—';
  const portalNet =
    portal.netImpact >= 0 ? `+${portal.netImpact.toFixed(1)}` : portal.netImpact.toFixed(1);

  const metrics = [
    { label: 'Scholarship Count', value: scholarship },
    { label: 'Returning Production', value: returning },
    { label: 'Blue-Chip Ratio', value: blueChip },
    { label: 'Portal Net Rating', value: portalNet },
  ];

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
