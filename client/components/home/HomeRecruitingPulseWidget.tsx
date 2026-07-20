'use client';

import React from 'react';
import { useRecruitingSummary } from '@/hooks/home/useRecruitingSummary';
import { useAnimatedMeter } from '@/hooks/home/useAnimatedMeter';
import { timeAgo } from '@/components/home/home-utils';
import { InViewObserver } from '@/components/home/InViewObserver';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeRecruitingPulseWidget(): React.ReactElement | null {
  const summary = useRecruitingSummary();
  const meterWidth = useAnimatedMeter(summary?.ufCommitProbability7d ?? 0);

  if (!summary) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  const updatedLabel = summary.updatedAt ? timeAgo(summary.updatedAt) : null;

  return (
    <InViewObserver className="gv-card gv-card--fade-in gv-card--pulse" visibleClass="gv-card--visible">
      <div data-testid="home-recruiting-pulse">
      <div className="gv-card__header">
        <div className="gv-card__title">Florida Recruiting — 2027</div>
        <div className="gv-card__meta">
          Class Rank {summary.classRank} • Blue Chip {summary.blueChipPercent}% • Avg Rating{' '}
          {summary.avgRating}
          {updatedLabel ? ` • Updated ${updatedLabel}` : ''}
        </div>
      </div>
      <div className="gv-card__body">
        <div className="gv-meter gv-meter--probability">
          <div className="gv-meter__label">UF Commit Probability (7d)</div>
          <div className="gv-meter__bar">
            <div
              className="gv-meter__fill gv-meter__fill--recruiting gv-meter__fill--animated"
              style={{ width: `${meterWidth}%` }}
            />
          </div>
        </div>
        <div className="gv-movement-summary">
          Movement: {summary.movement.up}↑ {summary.movement.down}↓ {summary.movement.volatile}⚡
        </div>
      </div>
      <div className="gv-card__footer">
        <a href={SITE_ROUTES.recruiting} className="gv-link">
          Open Recruiting Hub →
        </a>
      </div>
      </div>
    </InViewObserver>
  );
}
