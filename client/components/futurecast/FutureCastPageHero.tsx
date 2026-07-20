'use client';

import React from 'react';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import type { FutureCastHeatLevel, FutureCastHeroMetrics, FutureCastPageSummary } from '@/lib/api/futurecast';

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  lastUpdated?: string | null;
};

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

/** @deprecated Prefer FutureCastSubPageHero or lab/FutureCastHero — premium shell hero. */
export function FutureCastPageHero({ summary, metrics, heatLevel, lastUpdated }: Props): React.ReactElement {
  return (
    <section className="fc-lab-hero fc-lab-bleed fc-premium-sub-hero" data-testid="fc-page-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__col fc-lab-hero__col--overview">
          <p className="fc-lab-hero__eyebrow rh-cc-hero__eyebrow">FutureCast</p>
          <h1 className="fc-lab-hero__title rh-cc-hero__title">FutureCast</h1>
          <p className="fc-lab-hero__sub rh-cc-hero__sub">
            Where Florida stands — confidence, movement, and the schools in the fight.
          </p>
          <div className="fc-lab-hero__metrics rh-cc-hero__metrics">
            <div className="fc-lab-hero__metric rh-cc-hero__metric">
              <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Avg UF %</span>
              <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.avgUFProbability}%</strong>
            </div>
            <div className="fc-lab-hero__metric fc-lab-hero__metric--rank rh-cc-hero__metric rh-cc-hero__metric--rank">
              <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">High Priority</span>
              <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.highPriorityCount}</strong>
            </div>
            <div className="fc-lab-hero__metric rh-cc-hero__metric">
              <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Active Predictions</span>
              <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.activePredictions}</strong>
            </div>
            <div className="fc-lab-hero__metric rh-cc-hero__metric">
              <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Class Rank</span>
              <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">
                {summary.nationalRank != null ? `#${summary.nationalRank}` : '—'}
              </strong>
            </div>
            <div className="fc-lab-hero__metric rh-cc-hero__metric">
              <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Cycle Heat</span>
              <strong className={`fc-lab-hero__metric-value rh-cc-hero__metric-value fc-lab-hero__heat--${heatLevel}`}>
                {HEAT_LABELS[heatLevel]}
              </strong>
            </div>
          </div>
          {lastUpdated ? (
            <p className="fc-lab-hero__updated" data-testid="fc-page-hero-updated">
              Updated {formatRelativeUpdated(lastUpdated)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
