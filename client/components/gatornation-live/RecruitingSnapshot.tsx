'use client';

import React from 'react';
import type { RecruitingSnapshotProps } from '@/lib/gatornation-live-types';
import { GNL_COPY } from '@/lib/gatornation-live-types';

export function RecruitingSnapshot({
  commits,
  nationalRank,
  secRank,
  blueChips,
  inStatePercent,
  momentum,
  momentumTrend = 'neutral',
}: RecruitingSnapshotProps): React.ReactElement {
  const trendLabel =
    momentumTrend === 'up' ? '↑' : momentumTrend === 'down' ? '↓' : '→';

  return (
    <section className="gv-gnl-snapshot" aria-label="Recruiting snapshot" data-testid="gnl-snapshot">
      <h2 className="gv-gnl__section-title">{GNL_COPY.snapshot.title}</h2>
      <p className="gv-gnl-snapshot__subtitle">{GNL_COPY.snapshot.subtitle}</p>
      <div className="gv-gnl-snapshot__grid">
        <div>
          <p className="gv-gnl-snapshot__stat-label">Commits</p>
          <p className="gv-gnl-snapshot__stat-value">{commits}</p>
        </div>
        <div>
          <p className="gv-gnl-snapshot__stat-label">Nat&apos;l Rank</p>
          <p className="gv-gnl-snapshot__stat-value">
            {nationalRank != null ? `#${nationalRank}` : '—'}
          </p>
        </div>
        <div>
          <p className="gv-gnl-snapshot__stat-label">SEC Rank</p>
          <p className="gv-gnl-snapshot__stat-value">
            {secRank != null ? `#${secRank}` : '—'}
          </p>
        </div>
        <div>
          <p className="gv-gnl-snapshot__stat-label">Blue Chips</p>
          <p className="gv-gnl-snapshot__stat-value">{blueChips}</p>
        </div>
        <div>
          <p className="gv-gnl-snapshot__stat-label">In-State</p>
          <p className="gv-gnl-snapshot__stat-value">{inStatePercent}%</p>
        </div>
      </div>
      <div className="gv-gnl-snapshot__momentum">
        <span className="gv-gnl-snapshot__stat-label" style={{ margin: 0 }}>
          Momentum Meter: {momentum}% (Trending {trendLabel})
        </span>
        <div className="gv-gnl-snapshot__meter" aria-hidden="true">
          <div
            className="gv-gnl-snapshot__meter-fill"
            style={{ width: `${Math.min(100, momentum)}%` }}
          />
        </div>
      </div>
      <p className="gv-gnl-snapshot__cta">
        <a href="/vault/recruiting" className="gv-btn gv-btn--secondary">
          Open Recruiting Hub →
        </a>
      </p>
    </section>
  );
}
