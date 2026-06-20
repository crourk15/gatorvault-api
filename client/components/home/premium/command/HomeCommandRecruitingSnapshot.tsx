'use client';

import React from 'react';
import type { HomeRecruitingMetricsView } from '@/components/home/premium/command/home-command-utils';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  metrics: HomeRecruitingMetricsView;
  loading?: boolean;
};

export function HomeCommandRecruitingSnapshot({ metrics, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="home-section-header">
        <h2 className="home-section-title">Recruiting Command Snapshot</h2>
        <p className="home-section-subtitle">High-level view of UF&apos;s current class.</p>
      </div>
      <section className="home-card" data-testid="home-recruiting-snapshot">
        {loading ? (
          <div className="home-card-skeleton" aria-hidden="true" />
        ) : (
          <>
            <div className="home-metrics-row">
              <div>
                <p className="home-metric-label">Class rank</p>
                <p className="home-metric-value">{metrics.classRank}</p>
              </div>
              <div>
                <p className="home-metric-label">Blue chip %</p>
                <p className="home-metric-value">{metrics.blueChip}</p>
              </div>
              <div>
                <p className="home-metric-label">Commits</p>
                <p className="home-metric-value">{metrics.commits}</p>
              </div>
              <div>
                <p className="home-metric-label">Avg rating</p>
                <p className="home-metric-value">{metrics.avgRating}</p>
              </div>
            </div>
            <a href={VAULT_PILLAR_ROUTES.recruiting} className="home-strip-link" style={{ marginTop: 10, display: 'inline-block' }}>
              View full Recruiting Command Center →
            </a>
          </>
        )}
      </section>
    </>
  );
}
