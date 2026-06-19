'use client';

import React from 'react';
import { pipelineStateTier, formatPipelineUfPct } from './team-pipeline-utils';
import type { PipelinePreviewData } from './team-premium-types';

type Props = {
  data: PipelinePreviewData;
};

export function RecruitingPipelinePreview({ data }: Props): React.ReactElement {
  const maxCount = data.stateCounts.reduce((max, s) => Math.max(max, s.count), 0);

  return (
    <div className="team-pipeline-preview">
      <div className="team-pipeline-preview__map">
        <h3 className="team-pipeline-preview__heading">Pipeline Map</h3>
        <div className="team-pipeline-preview__states">
          {data.stateCounts.map((s) => {
            const tier = pipelineStateTier(s.count, maxCount);
            return (
              <div key={s.state} className="team-pipeline-preview__state">
                <span className="team-pipeline-preview__state-code">{s.state}</span>
                <span
                  className={`team-pipeline-preview__state-bar team-pipeline-preview__state-bar--${tier}`}
                  style={{ width: `${Math.max(12, Math.round((s.count / Math.max(maxCount, 1)) * 100))}%` }}
                />
                <span className="team-pipeline-preview__state-count">{s.count}</span>
              </div>
            );
          })}
        </div>
        <div className="team-pipeline-preview__averages">
          <span>
            Avg Fit Score: <strong>{data.avgFitScore || '—'}</strong>
          </span>
          <span>
            Avg FutureCast Prob:{' '}
            <strong>{data.avgFutureCastProb > 0 ? `${data.avgFutureCastProb}%` : '—'}</strong>
          </span>
        </div>
      </div>
      <div className="team-pipeline-preview__commits">
        <h3 className="team-pipeline-preview__heading">Top Commits</h3>
        <ul className="team-pipeline-preview__items">
          {data.topCommits.map((c) => (
            <li key={c.name} className="team-pipeline-preview__item">
              <span className="team-pipeline-preview__name">{c.name}</span>
              <span className="team-pipeline-preview__meta">
                {c.position} · {'★'.repeat(c.stars || 0)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="team-pipeline-preview__targets">
        <h3 className="team-pipeline-preview__heading">Top Targets</h3>
        <ul className="team-pipeline-preview__items">
          {data.topTargets.map((t) => (
            <li key={t.name} className="team-pipeline-preview__item">
              <span className="team-pipeline-preview__name">{t.name}</span>
              <span className="team-pipeline-preview__meta">
                {t.position} · {formatPipelineUfPct(t.ufProbability)} UF
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
