'use client';

import React from 'react';
import { useRecruitingSummary } from '@/hooks/home/useRecruitingSummary';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeRecruitingPulseWidget(): React.ReactElement | null {
  const summary = useRecruitingSummary();

  if (!summary) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  return (
    <div className="gv-card gv-card--pulse" data-testid="home-recruiting-pulse">
      <div className="gv-card__header">
        <div className="gv-card__title">UF Recruiting Pulse — 2027 Class</div>
        <div className="gv-card__meta">
          Class Rank {summary.classRank} • Blue Chip {summary.blueChipPercent}% • Avg Rating{' '}
          {summary.avgRating}
        </div>
      </div>
      <div className="gv-card__body">
        <div className="gv-meter gv-meter--probability">
          <div className="gv-meter__label">UF Commit Probability (7d)</div>
          <div className="gv-meter__bar">
            <div
              className="gv-meter__fill gv-meter__fill--recruiting"
              style={{ width: `${Math.min(100, Math.max(0, summary.ufCommitProbability7d))}%` }}
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
  );
}
