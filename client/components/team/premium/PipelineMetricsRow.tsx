'use client';

import React from 'react';

type Props = {
  avgFitScore: number;
  avgFutureCastProb: number;
  classYear?: number;
  positionStrengths?: string;
  portalStrategy?: string;
};

export function PipelineMetricsRow({
  avgFitScore,
  avgFutureCastProb,
  classYear = 2027,
  positionStrengths = 'EDGE, CB, OL depth',
  portalStrategy = 'Trench + DBU portal targets',
}: Props): React.ReactElement {
  return (
    <div className="team-pipeline-metrics">
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Class Year</span>
        <span className="team-pipeline-metrics__value">{classYear}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Avg Fit Score</span>
        <span className="team-pipeline-metrics__value">{avgFitScore}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">FutureCast Prob</span>
        <span className="team-pipeline-metrics__value">
          {avgFutureCastProb > 0 ? `${avgFutureCastProb}%` : '—'}
        </span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Position Strengths</span>
        <span className="team-pipeline-metrics__meta">{positionStrengths}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Portal Strategy</span>
        <span className="team-pipeline-metrics__meta">{portalStrategy}</span>
      </div>
    </div>
  );
}
