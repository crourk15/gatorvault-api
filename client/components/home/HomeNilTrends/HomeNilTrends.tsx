'use client';

import React from 'react';
import type { HomeNilPulse } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  data: HomeNilPulse | null;
  loading?: boolean;
};

export function HomeNilTrends({ data, loading }: Props): React.ReactElement {
  const secRank = data?.secRank ?? 0;
  const estPool = data?.estPool ?? '—';
  const movementLabel = data?.movementLabel ?? 'Stable';
  const movementDelta = data?.movementDelta ?? '—';
  const topEarner = data?.topEarner ?? 'Gators Collective';
  const topEarnerNote = data?.topEarnerNote ?? 'Tracking collective activity';

  if (loading && !data) {
    return (
      <article className="gv-home__cell gv-home__cell--6" aria-label="NIL pulse" data-testid="home-nil-trends">
        <div className="gv-home-skeleton gv-home-skeleton--card" />
      </article>
    );
  }

  return (
    <article className="gv-home__cell gv-home__cell--6" aria-label="NIL pulse" data-testid="home-nil-trends">
      <div className="gv-home-card">
        <div className="gv-home-card__accent" />
        <h2 className="gv-home-card__title">NIL Pulse</h2>
        <div className="gv-home-card__stats gv-home-card__stats--two">
          <div className="stat">
            <span>SEC NIL Rank</span>
            <strong>#{secRank || '—'}</strong>
          </div>
          <div className="stat">
            <span>Est. Pool</span>
            <strong>{estPool}</strong>
            <span className="gv-home-meta">
              {movementLabel} · {movementDelta}
            </span>
          </div>
        </div>
        <div className="gv-home-inline">
          <span className="gv-home-label">Top earner</span>
          <span className="gv-home-body">
            {topEarner} · <span className="gv-home-meta">{topEarnerNote}</span>
          </span>
        </div>
        <a href={SITE_ROUTES.nil} className="gv-home-link">
          Open NIL Tracker →
        </a>
      </div>
    </article>
  );
}
