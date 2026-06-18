'use client';

import React from 'react';
import { useFutureCastSummary } from '@/hooks/home/useFutureCastSummary';
import { useAnimatedMeter } from '@/hooks/home/useAnimatedMeter';
import { InViewObserver } from '@/components/home/InViewObserver';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeFutureCastPulseWidget(): React.ReactElement | null {
  const summary = useFutureCastSummary();
  const commitWidth = useAnimatedMeter(summary?.commitLikelihood7d ?? 0);
  const battleHeatWidth = useAnimatedMeter(summary?.battleHeatScore ?? 0);
  const volatilityWidth = useAnimatedMeter(summary?.volatilityIndex ?? 0);

  if (!summary) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  return (
    <InViewObserver
      className="gv-card gv-card--fade-in gv-card--pulse gv-card--futurecast"
      visibleClass="gv-card--visible"
    >
      <div data-testid="home-futurecast-pulse">
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
              className="gv-meter__fill gv-meter__fill--futurecast gv-meter__fill--animated"
              style={{ width: `${commitWidth}%` }}
            />
          </div>
        </div>
        <div className="gv-meter gv-battle-heat-meter">
          <div className="gv-meter__label">Battle Heat — {summary.battleHeat}</div>
          <div className="gv-meter__bar">
            <div
              className="gv-meter__fill gv-meter__fill--animated"
              style={{ width: `${battleHeatWidth}%` }}
            />
          </div>
        </div>
        <div className="gv-meter">
          <div className="gv-meter__label">Volatility Index</div>
          <div className="gv-meter__bar">
            <div
              className="gv-meter__fill gv-meter__fill--volatility gv-meter__fill--animated"
              style={{ width: `${volatilityWidth}%` }}
            />
          </div>
        </div>
      </div>
      <div className="gv-card__footer">
        <a href={SITE_ROUTES.futurecast} className="gv-link">
          Open FutureCast Lab →
        </a>
      </div>
      </div>
    </InViewObserver>
  );
}
