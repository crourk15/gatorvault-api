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
  const pool = data?.estPool ?? '—';
  const deal = data?.movementLabel ?? '—';
  const topDeal = data?.movementDelta ?? '—';
  const collective = data?.collective || 'Florida Victorious';
  const note = data?.topEarnerNote ?? 'Open NIL Tracker for full valuations';
  const top = data?.topEarner || collective;

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
        { value: pool, label: 'UF pool est.', tone: 'accent' },
        { value: deal, label: 'Market pulse', tone: 'up' },
        { value: topDeal, label: 'Top deal', tone: 'neutral' },
      ]}
      subtitle={note}
      link={{ href: VAULT_NIL, label: 'Open NIL Tracker →' }}
      ariaLabel="NIL tracker preview"
      testId="home-nil-trends"
    >
      <div className="gv-home-inline">
        <span className="gv-home-label">Top roster est.</span>
        <span className="gv-home-body">{top}</span>
      </div>
    </HomeModuleCard>
  );
}
