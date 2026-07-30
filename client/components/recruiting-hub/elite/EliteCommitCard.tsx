'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

/**
 * Fan-first commit card — light teaser only.
 * Full Evaluation / Vault Comp / Vault Projection live on the player profile
 * (click the name → /vault/recruiting/player/:slug).
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinny = commit.skinny?.trim() || null;
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';

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

      <p className="rh-commit-profile-hint">
        <a href={commit.profileUrl}>Full Vault eval · Comp · Projection →</a>
      </p>

      <div className="rh-commit-footer">
        <span>Committed {commit.commitDate}</span>
        {commit.rating && commit.rating !== '—' ? <span>Rating {commit.rating}</span> : null}
        {showJersey ? <span>#{commit.jerseyNumber}</span> : null}
        {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
      </div>
    </article>
  );
}
