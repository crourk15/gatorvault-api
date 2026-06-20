'use client';

import React, { useCallback } from 'react';
import {
  fetchRecruitingHubClassOverview,
  type RhHubClassOverview,
} from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

function MetricSparkline({ values }: { values: number[] }): React.ReactElement {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 56;
  const height = 18;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="rh-metric-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke="#FA4616" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function trendArrow(trend: string): string {
  if (trend === 'Rising') return '↑';
  if (trend === 'Falling') return '↓';
  return '→';
}

function Metric({
  label,
  value,
  trend,
  sparkline,
}: {
  label: string;
  value: string;
  trend: string;
  sparkline?: number[];
}): React.ReactElement {
  return (
    <div>
      <div className="rh-metric-label">{label}</div>
      <div className="rh-metric-value-row">
        <div className="rh-metric-value">{value}</div>
        {sparkline?.length ? <MetricSparkline values={sparkline} /> : null}
      </div>
      <div className="rh-metric-trend">
        <span className="rh-metric-trend-arrow" aria-hidden="true">
          {trendArrow(trend)}
        </span>{' '}
        {trend}
      </div>
    </div>
  );
}

export function RecruitingClassOverview(): React.ReactElement {
  const loadOverview = useCallback(() => fetchRecruitingHubClassOverview(), []);
  const { data, loading, error } = useRecruitingHubQuery<RhHubClassOverview>(loadOverview);

  const sparks = data?.sparklines;

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Class Overview</div>
        <div className="rh-section-subtitle">Snapshot of UF&apos;s current recruiting class.</div>
      </div>
      <section className="rh-card rh-card--watermark" data-testid="rh-elite-class-overview">
        <span className="rh-card-watermark" aria-hidden="true">
          UF
        </span>
        {loading ? (
          <div className="rh-skeleton" aria-hidden="true" />
        ) : !data ? (
          <p className="rh-empty">{error ? 'Could not load class overview.' : 'Class overview unavailable.'}</p>
        ) : (
          <div className="rh-metrics-row">
            <Metric label="Class rank" value={data.classRank} trend={data.trendRank} sparkline={sparks?.classRank} />
            <Metric label="Blue chip %" value={data.blueChip} trend={data.trendBlueChip} sparkline={sparks?.blueChip} />
            <Metric label="Commits" value={data.commits} trend={data.trendCommits} sparkline={sparks?.commits} />
            <Metric label="Avg rating" value={data.avgRating} trend={data.trendRating} sparkline={sparks?.avgRating} />
          </div>
        )}
      </section>
    </>
  );
}
