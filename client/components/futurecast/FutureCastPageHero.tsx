'use client';

import React from 'react';
import type { FutureCastHeatLevel, FutureCastHeroMetrics, FutureCastPageSummary } from '@/lib/api/futurecast';

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
};

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

export function FutureCastPageHero({ summary, metrics, heatLevel }: Props): React.ReactElement {
  return (
    <header className="fc-page-hero futurecast-page__section" data-testid="fc-page-hero">
      <h1 className="fc-page-hero__title">FutureCast — UF Recruiting Prediction &amp; Intel</h1>
      <p className="fc-page-hero__sub">
        Commit likelihood, movement, fit scores, competing schools, and deep player profiles — all in one
        layer.
      </p>
      <div className="fc-page-hero__metrics">
        <div className="fc-page-hero__metric">
          <span className="fc-page-hero__metric-value">{metrics.avgUFProbability}%</span>
          <span className="fc-page-hero__metric-label">Avg UF probability (targets)</span>
        </div>
        <div className="fc-page-hero__metric">
          <span className="fc-page-hero__metric-value">{metrics.highPriorityCount}</span>
          <span className="fc-page-hero__metric-label">High-priority players</span>
        </div>
        <div className="fc-page-hero__metric">
          <span className="fc-page-hero__metric-value">{metrics.activePredictions}</span>
          <span className="fc-page-hero__metric-label">Active predictions</span>
        </div>
        <div className="fc-page-hero__metric">
          <span className="fc-page-hero__metric-value">
            {summary.nationalRank != null ? `#${summary.nationalRank}` : '—'}
          </span>
          <span className="fc-page-hero__metric-label">Class of {summary.classYear} natl rank</span>
        </div>
      </div>
      <span className={`fc-page-hero__heat fc-page-hero__heat--${heatLevel}`}>{HEAT_LABELS[heatLevel]}</span>
    </header>
  );
}
