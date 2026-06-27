'use client';

import React, { useEffect, useState } from 'react';
import type { RhHubClassOverview } from '@/lib/recruiting-hub-elite-api';
import { fetchClassMetrics } from '@/lib/recruiting-ui-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { classCommitMetricLabel } from '@/lib/recruiting-cycle';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { warmPollProfile } from '@/lib/warm-poll-profile';
import { useRecruitingHubBundleContext } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { readBootClassMetrics, hideRhBootSection } from '@/lib/recruiting-hub-boot-read';

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

export function RecruitingClassOverview(): React.ReactElement | null {
  const { activeYear } = useRecruitingClassYear();
  const { data: bundle, loading: bundleLoading } = useRecruitingHubBundleContext();
  const [overview, setOverview] = useState<RhHubClassOverview | null>(() => readBootClassMetrics(activeYear));
  const [loading, setLoading] = useState(() => !readBootClassMetrics(activeYear));
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const seeded = readBootClassMetrics(activeYear);
    const fromBundle =
      bundle?.year === activeYear
        ? bundle.classOverview
        : bundle?.classOverviewAll?.[activeYear as 2026 | 2027 | 2028];
    if (fromBundle) {
      setOverview(fromBundle);
      setLoading(false);
      setError(false);
      return;
    }

    setOverview(seeded);
    if (bundleLoading) {
      setLoading(!seeded);
      return;
    }
    setLoading(!seeded);
    setError(false);
    void fetchWithWarmPoll(() => fetchClassMetrics(activeYear), warmPollProfile())
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled && !seeded) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeYear, bundle, bundleLoading]);

  useEffect(() => {
    const onBoot = () => {
      const seeded = readBootClassMetrics(activeYear);
      if (seeded) {
        setOverview(seeded);
        setLoading(false);
      }
    };
    window.addEventListener('gv-hub-boot', onBoot);
    window.addEventListener('gv-hero-boot', onBoot);
    return () => {
      window.removeEventListener('gv-hub-boot', onBoot);
      window.removeEventListener('gv-hero-boot', onBoot);
    };
  }, [activeYear]);

  useEffect(() => {
    if (overview) hideRhBootSection('class-overview');
  }, [overview]);

  const sparks = overview?.sparklines;

  if (loading && !overview) return null;

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Class Overview</div>
        <div className="rh-section-subtitle">Snapshot of UF&apos;s {activeYear} recruiting class.</div>
      </div>
      <section className="rh-card rh-card--watermark" data-testid="rh-elite-class-overview">
        <span className="rh-card-watermark" aria-hidden="true">
          UF
        </span>
        {loading ? (
          <div className="rh-skeleton" aria-hidden="true" />
        ) : !overview ? (
          <p className="rh-empty">{error ? 'Could not load class overview.' : 'Class overview unavailable.'}</p>
        ) : (
          <div className="rh-metrics-row">
            <Metric label="Class rank" value={overview.classRank} trend={overview.trendRank} sparkline={sparks?.classRank} />
            <Metric label="Blue chip %" value={overview.blueChip} trend={overview.trendBlueChip} sparkline={sparks?.blueChip} />
            <Metric
              label={overview.commitLabel ?? classCommitMetricLabel(activeYear)}
              value={overview.commits}
              trend={overview.trendCommits}
              sparkline={sparks?.commits}
            />
            <Metric label="Avg rating" value={overview.avgRating} trend={overview.trendRating} sparkline={sparks?.avgRating} />
          </div>
        )}
      </section>
    </>
  );
}
