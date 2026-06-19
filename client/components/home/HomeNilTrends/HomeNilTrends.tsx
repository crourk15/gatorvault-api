'use client';

import React from 'react';
import type { HomeNilPulse } from '@/lib/vault-home-api';
const VAULT_NIL = '/vault/nil';
import { HomeModuleCard } from '@/components/home/HomeModuleCard';

type Props = {
  data: HomeNilPulse | null;
  loading?: boolean;
};

function competitivenessGrade(secRank: number): string {
  if (!secRank || secRank <= 0) return 'TBD';
  if (secRank <= 3) return 'A';
  if (secRank <= 6) return 'A-';
  if (secRank <= 10) return 'B+';
  if (secRank <= 12) return 'B';
  return 'B-';
}

export function HomeNilTrends({ data, loading }: Props): React.ReactElement {
  const secRank = data?.secRank ?? 0;
  const estPool = data?.estPool ?? '—';
  const movementLabel = data?.movementLabel ?? 'Stable';
  const movementDelta = data?.movementDelta ?? '—';
  const topEarner = data?.topEarner ?? 'Gators Collective';
  const topEarnerNote = data?.topEarnerNote ?? 'Tracking collective activity';
  const grade = competitivenessGrade(secRank);

  if (loading && !data) {
    return (
      <HomeModuleCard
        gridClass="gv-home__cell--6"
        eyebrow="NIL Command Center"
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
      eyebrow="NIL Command Center"
      title="NIL Tracker Preview"
      stats={[
        { value: estPool, label: 'NIL valuation', tone: 'accent' },
        { value: grade, label: 'Competitiveness', tone: 'up' },
        { value: secRank ? `#${secRank}` : '—', label: 'SEC rank', tone: 'neutral' },
      ]}
      subtitle={`${movementLabel} · ${movementDelta}`}
      link={{ href: VAULT_NIL, label: 'Open NIL Command Center →' }}
      ariaLabel="NIL tracker preview"
      testId="home-nil-trends"
    >
      <div className="gv-home-inline">
        <span className="gv-home-label">Top mover</span>
        <span className="gv-home-body">
          {topEarner} · <span className="gv-home-meta">{topEarnerNote}</span>
        </span>
      </div>
    </HomeModuleCard>
  );
}
