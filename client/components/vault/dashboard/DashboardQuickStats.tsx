'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { buildDashboardQuickStats } from './dashboard-quick-stats-data';

type Props = {
  snapshot: RecruitingSnapshot | null;
  momentumPct: number;
  movementDelta?: number | null;
  loading?: boolean;
};

export function DashboardQuickStats({
  snapshot,
  momentumPct,
  movementDelta,
  loading,
}: Props): React.ReactElement {
  if (loading || !snapshot) {
    return (
      <article className="gv-dash-panel gv-dash-card" aria-label="Quick stats">
        <div className="gv-dash-skeleton" style={{ minHeight: 140 }} />
      </article>
    );
  }

  const stats = buildDashboardQuickStats(snapshot, momentumPct, movementDelta);

  return (
    <article className="gv-dash-panel gv-dash-card" aria-label="Quick stats" data-testid="dashboard-quick-stats">
      <p className="gv-dash-card__eyebrow">Program Snapshot</p>
      <h2 className="gv-dash-panel__title">Quick Stats</h2>
      <div className="gv-dash-quick-stats">
        {stats.map((stat) => {
          const toneClass = stat.tone ? ` gv-dash-quick-stats__value--${stat.tone}` : '';
          const inner = (
            <>
              <p className={`gv-dash-quick-stats__value${toneClass}`}>{stat.value}</p>
              <p className="gv-dash-card__meta">{stat.label}</p>
            </>
          );
          return stat.href ? (
            <a key={stat.label} href={stat.href} className="gv-dash-quick-stats__item">
              {inner}
            </a>
          ) : (
            <div key={stat.label} className="gv-dash-quick-stats__item">
              {inner}
            </div>
          );
        })}
      </div>
    </article>
  );
}
