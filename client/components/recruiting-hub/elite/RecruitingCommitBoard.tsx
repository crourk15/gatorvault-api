'use client';

import React from 'react';
import type { RhCommitView } from '@/components/recruiting-hub/elite/rh-elite-utils';

type Props = {
  commits: RhCommitView[];
  loading?: boolean;
};

function CommitCard({ commit }: { commit: RhCommitView }): React.ReactElement {
  return (
    <article className="rh-commit-card">
      <div className="rh-commit-header">
        <div>
          <a href={commit.href} className="rh-commit-name">
            {commit.name}
          </a>
          <div className="rh-commit-pos">{commit.position}</div>
        </div>
        {commit.statusBadge ? <span className="rh-badge">{commit.statusBadge}</span> : null}
      </div>
      <div className="rh-commit-body">{commit.rankNote}</div>
      <div className="rh-commit-footer">
        <span>Rating {commit.rating}</span>
        <span>Committed {commit.commitDate}</span>
      </div>
    </article>
  );
}

export function RecruitingCommitBoard({ commits, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Commit Board</div>
        <div className="rh-section-subtitle">Current UF commits with rating and status.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-commit-board" aria-hidden="true" />
      ) : commits.length === 0 ? (
        <section className="rh-card" data-testid="rh-elite-commit-board">
          <p className="rh-empty">No commits loaded for this class yet.</p>
        </section>
      ) : (
        <section className="rh-commit-grid" data-testid="rh-elite-commit-board">
          {commits.map((commit) => (
            <CommitCard key={commit.id} commit={commit} />
          ))}
        </section>
      )}
    </>
  );
}
