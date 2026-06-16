'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function DashboardNilTrends({ snapshot }: Props): React.ReactElement {
  const secRank = snapshot?.nilSecRank ?? 4;

  return (
    <article className="gv-dash-card gv-dash-today__card" data-testid="dashboard-nil-trends">
      <p className="gv-dash-card__eyebrow">NIL Pulse</p>
      <p className="gv-dash-card__stat">#{secRank}</p>
      <p className="gv-dash-card__meta">SEC NIL Rank</p>
      <div className="gv-dash-card__nil-row">
        <div>
          <p className="gv-dash-card__nil-label">Est. Pool</p>
          <p className="gv-dash-card__nil-value">$18.2M</p>
          <span className="gv-dash-card__trend gv-dash-card__trend--up">↑ +6% YoY</span>
        </div>
        <div>
          <p className="gv-dash-card__nil-label">Top Earner</p>
          <p className="gv-dash-card__nil-value" style={{ fontSize: '0.9375rem' }}>
            Gators Collective
          </p>
          <span className="gv-dash-card__meta">3 new deals this week</span>
        </div>
      </div>
      <a href={SITE_ROUTES.nil} className="gv-dash-card__link">
        NIL Tracker →
      </a>
    </article>
  );
}
