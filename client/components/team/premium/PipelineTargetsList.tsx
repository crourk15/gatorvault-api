'use client';

import React from 'react';

type Target = { name: string; position: string; ufProbability: number };

type Props = {
  targets: Target[];
};

export function PipelineTargetsList({ targets }: Props): React.ReactElement {
  return (
    <div className="team-pipeline-list">
      <h3 className="team-pipeline-list__title">Top Targets</h3>
      <ul className="team-pipeline-list__items">
        {targets.map((t) => (
          <li key={t.name} className="team-pipeline-list__item">
            <span className="team-pipeline-list__name">{t.name}</span>
            <span className="team-pipeline-list__meta">{t.position}</span>
            <span className="team-pipeline-list__prob">{t.ufProbability}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
