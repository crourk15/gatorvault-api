'use client';

import React from 'react';

type StateCount = { state: string; count: number };

type Props = {
  states: StateCount[];
};

export function PipelineMap({ states }: Props): React.ReactElement {
  return (
    <div className="team-pipeline-map">
      <h3 className="team-pipeline-map__title">State Pipeline Map</h3>
      <div className="team-pipeline-map__grid">
        {states.map((s) => (
          <div key={s.state} className="team-pipeline-map__cell">
            <span className="team-pipeline-map__code">{s.state}</span>
            <div className="team-pipeline-map__bar-wrap">
              <span className="team-pipeline-map__bar" style={{ height: `${Math.min(100, s.count * 10)}%` }} />
            </div>
            <span className="team-pipeline-map__count">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
