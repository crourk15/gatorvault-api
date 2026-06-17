'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import './HomeNilTrends.css';

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function HomeNilTrends({ snapshot }: Props): React.ReactElement {
  const secRank = snapshot?.nilSecRank ?? 4;

  return (
    <article
      className="gv-home__cell gv-home__cell--6 gv-home-card"
      aria-label="NIL trends"
      data-testid="home-nil-trends"
    >
      <p className="gv-home-card__eyebrow">NIL Pulse</p>
      <p className="gv-home-card__stat">#{secRank}</p>
      <p className="gv-home-card__meta">SEC NIL Rank</p>
      <div className="gv-home-card__nil-row">
        <div>
          <p className="gv-home-card__nil-label">Est. Pool</p>
          <p className="gv-home-card__nil-value">$18.2M</p>
          <span className="gv-home-card__trend gv-home-card__trend--up">↑ +6% YoY</span>
        </div>
        <div>
          <p className="gv-home-card__nil-label">Top Earner</p>
          <p className="gv-home-card__nil-value gv-home-card__nil-value--sm">Gators Collective</p>
          <span className="gv-home-card__meta">3 new deals this week</span>
        </div>
      </div>
      <a href={SITE_ROUTES.nil} className="gv-home-card__link">
        NIL Tracker →
      </a>
    </article>
  );
}
