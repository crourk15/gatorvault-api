'use client';

import React from 'react';
import { useFutureCastSummary } from '@/hooks/home/useFutureCastSummary';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeFutureCastPulseWidget(): React.ReactElement | null {
  const summary = useFutureCastSummary();

  if (!summary) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  return (
    <div className="gv-card gv-card--pulse gv-card--futurecast" data-testid="home-futurecast-pulse">
      <div className="gv-card__header">
        <div className="gv-card__title">UF FutureCast Pulse — 2027 Class</div>
        <div className="gv-card__meta">
          Active Battles {summary.activeBattles} • Volatility {summary.volatilityIndex}⚡
        </div>
      </div>
      <div className="gv-card__body">
        <div className="gv-meter gv-meter--probability">
          <div className="gv-meter__label">Commit Likelihood (7d)</div>
          <div className="gv-meter__bar">
            <div
              className="gv-meter__fill gv-meter__fill--futurecast"
              style={{ width: `${Math.min(100, Math.max(0, summary.commitLikelihood7d))}%` }}
            />
          </div>
        </div>
        <div className="gv-battle-heat">Battle Heat: {summary.battleHeat}</div>
      </div>
      <div className="gv-card__footer">
        <a href={SITE_ROUTES.futurecast} className="gv-link">
          Open FutureCast Lab →
        </a>
      </div>
    </div>
  );
}
