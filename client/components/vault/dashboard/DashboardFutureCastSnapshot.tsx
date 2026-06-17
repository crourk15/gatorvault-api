'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { heatmapSparkPct } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  data: StaffDashboardResponse | null;
  loading?: boolean;
};

function fitBadge(delta: number | null | undefined): { label: string; tone: 'elite' | 'strong' | 'watch' } {
  const d = delta ?? 0;
  if (d >= 8) return { label: 'Elite fit', tone: 'elite' };
  if (d >= 3) return { label: 'Strong fit', tone: 'strong' };
  return { label: 'Watch', tone: 'watch' };
}

export function DashboardFutureCastSnapshot({ data, loading }: Props): React.ReactElement {
  if (loading || !data) {
    return (
      <article className="gv-dash-panel gv-dash-card" aria-label="FutureCast snapshot">
        <div className="gv-dash-skeleton" style={{ minHeight: 220 }} />
      </article>
    );
  }

  const leaders = [...(data.topRisers ?? [])]
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 3);
  const sparkPct = heatmapSparkPct(data.heatmap.buckets);

  return (
    <article className="gv-dash-panel gv-dash-card" aria-label="FutureCast snapshot" data-testid="dashboard-futurecast">
      <p className="gv-dash-card__eyebrow">FutureCast</p>
      <h2 className="gv-dash-panel__title">Momentum Snapshot</h2>
      <ul className="gv-dash-fc-leaders">
        {leaders.map((p, idx) => {
          const badge = fitBadge(p.delta);
          const pct = Math.min(99, Math.max(35, 55 + (p.delta ?? 0) * 2));
          return (
            <li key={p.id} className="gv-dash-fc-leaders__row">
              <span className="gv-dash-fc-leaders__rank">#{idx + 1}</span>
              <div className="gv-dash-fc-leaders__body">
                <a
                  href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                  className="gv-dash-fc-leaders__name"
                >
                  {p.name}
                </a>
                <div className="gv-dash-fc-leaders__meta">
                  <span className="gv-dash-fc-leaders__pct">{pct}% UF</span>
                  <span className={`gv-dash-fc-leaders__delta gv-dash-fc-leaders__delta--${(p.delta ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(p.delta ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(p.delta ?? 0)}
                  </span>
                  <span className={`gv-dash-fc-leaders__badge gv-dash-fc-leaders__badge--${badge.tone}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
        {leaders.length === 0 && (
          <li className="gv-dash-gnl-preview__empty">FutureCast probabilities updating.</li>
        )}
      </ul>
      <p className="gv-dash-card__meta">
        {data.movementWindowDays || 7}-day volatility: <strong>{sparkPct}%</strong>
      </p>
      <a href={`${SITE_ROUTES.futurecast}/movement`} className="gv-dash-card__link">
        Open FutureCast →
      </a>
    </article>
  );
}
