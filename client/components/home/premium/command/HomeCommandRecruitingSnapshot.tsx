'use client';

import React from 'react';
import type { HomeMetricBlock } from '@/components/home/premium/command/home-command-utils';
import type { HomeRecruitingMetricsView } from '@/components/home/premium/command/home-command-utils';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  metrics: HomeRecruitingMetricsView;
  loading?: boolean;
};

const BOOT_METRICS = [
  { label: 'Class rank', key: 'class-rank' },
  { label: 'Blue chip %', key: 'blue-chip' },
  { label: 'Commits', key: 'commits' },
  { label: 'Avg rating', key: 'avg-rating' },
] as const;

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
    <svg className="home-wow-metric-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke="#FA4616" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function MetricBlock({
  block,
  updatedLabel,
}: {
  block: HomeMetricBlock;
  updatedLabel: string;
}): React.ReactElement {
  return (
    <div className="home-wow-metric-block">
      <p className="home-wow-metric-label">{block.label}</p>
      <div className="home-wow-metric-value-row">
        <p className="home-wow-metric-value">{block.value}</p>
        <span className={`home-wow-metric-trend home-wow-metric-trend--${block.trend}`}>{block.trendLabel}</span>
      </div>
      <MetricSparkline values={block.sparkline} />
      <p className="home-wow-metric-updated">{updatedLabel}</p>
    </div>
  );
}

export function HomeCommandRecruitingSnapshot({ metrics, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Recruiting Command Snapshot</h2>
        <p className="home-wow-section-subtitle">High-level view of UF&apos;s current class.</p>
      </div>
      <section className="home-wow-card" data-testid="home-recruiting-snapshot" data-home-boot="recruiting-snapshot">
        <span className="home-wow-card-watermark" aria-hidden="true">
          UF
        </span>
        {loading ? (
          <>
            <div className="home-wow-skeleton home-wow-skeleton--overlay" data-home-boot-skeleton aria-hidden="true" />
            <div data-home-boot-body>
              <div className="home-wow-metrics-row">
                {BOOT_METRICS.map((item) => (
                  <div className="home-wow-metric-block" key={item.key}>
                    <p className="home-wow-metric-label">{item.label}</p>
                    <p className="home-wow-metric-value" data-home-metric={item.key}>
                      —
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="home-wow-metrics-row">
              {metrics.blocks.map((block) => (
                <MetricBlock key={block.label} block={block} updatedLabel={metrics.updatedLabel} />
              ))}
            </div>
            <a href={VAULT_PILLAR_ROUTES.recruiting} className="home-wow-cta-link">
              View full Recruiting Command Center →
            </a>
          </>
        )}
      </section>
    </>
  );
}
