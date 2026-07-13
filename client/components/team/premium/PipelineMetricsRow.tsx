'use client';

import React from 'react';

type Props = {
  avgFitScore: number;
  avgFutureCastProb: number;
  classYear?: number;
};

/** Real board metrics only — no canned position-strength / portal-strategy lines. */
export function PipelineMetricsRow({
  avgFitScore,
  avgFutureCastProb,
  classYear = 2027,
}: Props): React.ReactElement {
  return (
    <div className="team-pipeline-metrics team-pipeline-metrics--lean">
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Class Year</span>
        <span className="team-pipeline-metrics__value">{classYear}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">Avg Fit Score</span>
        <span className="team-pipeline-metrics__value">{avgFitScore > 0 ? avgFitScore : '—'}</span>
      </div>
      <div className="team-pipeline-metrics__card">
        <span className="team-pipeline-metrics__label">FutureCast Prob</span>
        <span className="team-pipeline-metrics__value">
          {avgFutureCastProb > 0 ? `${avgFutureCastProb}%` : '—'}
        </span>
      </div>
    </div>
  );
}
