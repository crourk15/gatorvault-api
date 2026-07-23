'use client';

import React from 'react';

type Commit = { name: string; position: string; stars: number };

type Props = {
  commits: Commit[];
};

export function PipelineCommitsList({ commits }: Props): React.ReactElement {
  return (
    <div className="team-pipeline-list">
      <h3 className="team-pipeline-list__title">Top Commits</h3>
      {commits.length === 0 ? (
        <p className="team-pipeline-list__empty">No commits on this board slice.</p>
      ) : (
        <ol className="team-pipeline-list__items">
          {commits.map((c, i) => (
            <li key={c.name} className="team-pipeline-list__item">
              <span className="team-pipeline-list__rank">{i + 1}</span>
              <span className="team-pipeline-list__body">
                <span className="team-pipeline-list__name">{c.name}</span>
                <span className="team-pipeline-list__meta">{c.position}</span>
              </span>
              <span className="team-pipeline-list__badge">{'★'.repeat(c.stars || 0) || '—'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
