'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { teamScholarshipCount } from '@/hooks/home/useUfPremiumHomeData';
import type { TeamHubBundle } from '@/lib/team-hub-api';
import { UfPremiumMetric, UfPremiumSection } from './primitives';

type SnapshotMetric = {
  id: string;
  label: string;
  value: string;
};

type Props = {
  team: TeamHubBundle | null;
  metrics: SnapshotMetric[];
  loading?: boolean;
};

export function TeamSnapshotPreview({ team, metrics, loading }: Props): React.ReactElement {
  const scholarship = teamScholarshipCount(team);
  const returning = metrics.find((m) => m.id === 'returning')?.value ?? '—';
  const blueChip = metrics.find((m) => m.id === 'bcr')?.value ?? '—';
  const portalNet = metrics.find((m) => m.id === 'portal-net')?.value ?? '—';

  return (
    <UfPremiumSection
      title="Team Snapshot"
      ctaLabel="View Team Page"
      ctaHref={VAULT_PILLAR_ROUTES.team}
      testId="uf-premium-team"
    >
      <div className="uf-premium-grid uf-premium-grid--4">
        {loading ? (
          <>
            <div className="uf-premium-skeleton" />
            <div className="uf-premium-skeleton" />
            <div className="uf-premium-skeleton" />
            <div className="uf-premium-skeleton" />
          </>
        ) : (
          <>
            <div className="uf-premium-card">
              <UfPremiumMetric label="Scholarship Count" value={scholarship} />
            </div>
            <div className="uf-premium-card">
              <UfPremiumMetric label="Returning Production" value={returning} />
            </div>
            <div className="uf-premium-card">
              <UfPremiumMetric label="Blue-Chip Ratio" value={blueChip} />
            </div>
            <div className="uf-premium-card">
              <UfPremiumMetric label="Portal Net Rating" value={portalNet} />
            </div>
          </>
        )}
      </div>
    </UfPremiumSection>
  );
}
