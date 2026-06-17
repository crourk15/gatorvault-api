'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  snapshot: RecruitingSnapshot | null;
  momentumPct: number;
  movementDelta?: number | null;
  loading?: boolean;
};

type StatItem = {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral' | 'hot' | 'cooling';
  href?: string;
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

  const portalTone: StatItem['tone'] =
    snapshot.portalActive >= 10 ? 'hot' : snapshot.portalActive >= 5 ? 'neutral' : 'cooling';
  const nilTone: StatItem['tone'] =
    snapshot.nilSecRank != null && snapshot.nilSecRank <= 5 ? 'up' : 'neutral';
  const fcTone: StatItem['tone'] =
    movementDelta != null ? (movementDelta >= 0 ? 'up' : 'down') : momentumPct >= 60 ? 'up' : 'neutral';

  const stats: StatItem[] = [
    {
      label: 'Class Rank',
      value: snapshot.classRank != null ? `#${snapshot.classRank}` : '—',
      href: `${SITE_ROUTES.recruiting}/board`,
    },
    {
      label: 'Blue Chip %',
      value: `${momentumPct}%`,
      tone: momentumPct >= 70 ? 'up' : momentumPct >= 50 ? 'neutral' : 'down',
      href: SITE_ROUTES.futurecast,
    },
    {
      label: 'Portal Movement',
      value: String(snapshot.portalActive),
      tone: portalTone,
      href: `${SITE_ROUTES.recruiting}/portal`,
    },
    {
      label: 'NIL Trend',
      value: snapshot.nilSecRank != null ? `#${snapshot.nilSecRank} SEC` : '—',
      tone: nilTone,
      href: SITE_ROUTES.nil,
    },
    {
      label: 'FutureCast Movement',
      value: movementDelta != null ? `${movementDelta >= 0 ? '+' : ''}${movementDelta}` : `${momentumPct}%`,
      tone: fcTone,
      href: `${SITE_ROUTES.futurecast}/movement`,
    },
  ];

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
