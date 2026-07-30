'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

/**
 * Fan-first commit card — uses the same slots the iOS binary already renders:
 * Evaluation skinny · Strengths · Comp · Projection (live from the hub API).
 * Profile click still opens the full Vault Scouting page.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinny = commit.skinny?.trim() || null;
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const comp = commit.playerComp?.trim() || null;
  const showComp = Boolean(comp && !/^tbd$/i.test(comp) && !(skinny && skinny.includes(comp)));

  return (
    <article className="rh-commit-card rh-elite-commit-card" data-testid="rh-elite-commit-card">
      <div className="rh-commit-header">
        <div>
          <a href={commit.profileUrl} className="rh-commit-name">
            {commit.name}
          </a>
          {meta ? <p className="rh-commit-meta">{meta}</p> : null}
        </div>
        <div className="rh-commit-badges">
          {commit.inState ? <span className="rh-badge rh-badge--instate">In-state</span> : null}
          {commit.statusBadge ? <span className="rh-badge">{commit.statusBadge}</span> : null}
        </div>
      </div>

      {skinny ? <p className="rh-commit-skinny">{skinny}</p> : null}

      {commit.strengths ? (
        <p className="rh-commit-strengths">
          <span className="rh-commit-strengths__label">Strengths</span>
          {commit.strengths}
        </p>
      ) : null}

      {showComp ? (
        <p className="rh-commit-strengths">
          <span className="rh-commit-strengths__label">Comp</span>
          {comp}
        </p>
      ) : null}

      {commit.projection ? <p className="rh-commit-projection">{commit.projection}</p> : null}

      <div className="rh-commit-footer">
        <span>Committed {commit.commitDate}</span>
        {commit.rating && commit.rating !== '—' ? <span>Rating {commit.rating}</span> : null}
        {showJersey ? <span>#{commit.jerseyNumber}</span> : null}
        {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
      </div>
    </article>
  );
}
