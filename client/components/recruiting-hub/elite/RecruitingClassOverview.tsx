'use client';

import React from 'react';
import type { RhClassMetrics } from '@/components/recruiting-hub/elite/rh-elite-utils';

type Props = {
  metrics: RhClassMetrics;
  loading?: boolean;
};

function Metric({ label, value, trend }: { label: string; value: string; trend: string }): React.ReactElement {
  return (
    <div>
      <div className="rh-metric-label">{label}</div>
      <div className="rh-metric-value">{value}</div>
      <div className="rh-metric-trend">{trend}</div>
    </div>
  );
}

export function RecruitingClassOverview({ metrics, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Class Overview</div>
        <div className="rh-section-subtitle">Snapshot of UF&apos;s current recruiting class.</div>
      </div>
      <section className="rh-card" data-testid="rh-elite-class-overview">
        {loading ? (
          <div className="rh-skeleton" aria-hidden="true" />
        ) : (
          <div className="rh-metrics-row">
            <Metric label="Class rank" value={metrics.classRank} trend={metrics.trendRank} />
            <Metric label="Blue chip %" value={metrics.blueChip} trend={metrics.trendBlueChip} />
            <Metric label="Commits" value={metrics.commits} trend={metrics.trendCommits} />
            <Metric label="Avg rating" value={metrics.avgRating} trend={metrics.trendRating} />
          </div>
        )}
      </section>
    </>
  );
}
