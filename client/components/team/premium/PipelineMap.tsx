'use client';

import React from 'react';
import { pipelineStateTier } from './team-pipeline-utils';

type StateCount = { state: string; count: number };

type Props = {
  states: StateCount[];
};

export function PipelineMap({ states }: Props): React.ReactElement {
  const maxCount = states.reduce((max, s) => Math.max(max, s.count), 0);

  return (
    <div className="team-pipeline-map">
      <h3 className="team-pipeline-map__title">State footprint</h3>
      {states.length === 0 ? (
        <p className="team-pipeline-list__empty">No state footprint on this board slice.</p>
      ) : (
        <div className="team-pipeline-map__grid">
          {states.map((s) => {
            const tier = pipelineStateTier(s.count, maxCount);
            const pct = Math.max(8, Math.round((s.count / Math.max(maxCount, 1)) * 100));
            return (
              <div
                key={s.state}
                className="team-pipeline-map__cell"
                style={{ '--pipeline-pct': `${pct}%` } as React.CSSProperties}
              >
                <span className="team-pipeline-map__code">{s.state}</span>
                <div className="team-pipeline-map__bar-wrap">
                  <span className={`team-pipeline-map__bar team-pipeline-map__bar--${tier}`} />
                </div>
                <span className="team-pipeline-map__count">{s.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
