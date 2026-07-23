'use client';

import React from 'react';
import type { HomeNilPulse } from '@/lib/vault-home-api';
const VAULT_NIL = '/vault/nil';
import { HomeModuleCard } from '@/components/home/HomeModuleCard';

type Props = {
  data: HomeNilPulse | null;
  loading?: boolean;
};

export function HomeNilTrends({ data, loading }: Props): React.ReactElement {
  const commits = data?.commits != null ? String(data.commits) : data?.estPool ?? '—';
  const blueChip = data?.blueChipPct != null ? `${data.blueChipPct}%` : data?.movementLabel ?? '—';
  const collective = data?.collective || data?.topEarner || 'Florida Victorious';
  const note = data?.topEarnerNote ?? 'Open NIL Tracker for the elite board';

  if (loading && !data) {
    return (
      <HomeModuleCard
        gridClass="gv-home__cell--6"
        eyebrow="NIL Tracker"
        title="NIL Tracker Preview"
        ariaLabel="NIL tracker preview"
        testId="home-nil-trends"
        loading
        skeletonHeight={220}
      />
    );
  }

  return (
    <HomeModuleCard
      gridClass="gv-home__cell--6"
      eyebrow="NIL Tracker"
      title="NIL Tracker Preview"
      stats={[
        { value: commits, label: 'UF commits', tone: 'accent' },
        { value: blueChip, label: 'Blue-chip share', tone: 'up' },
        { value: data?.movementDelta ?? '—', label: 'Avg rating', tone: 'neutral' },
      ]}
      subtitle={note}
      link={{ href: VAULT_NIL, label: 'Open NIL Tracker →' }}
      ariaLabel="NIL tracker preview"
      testId="home-nil-trends"
    >
      <div className="gv-home-inline">
        <span className="gv-home-label">Collective</span>
        <span className="gv-home-body">{collective}</span>
      </div>
    </HomeModuleCard>
  );
}
