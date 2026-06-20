'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubCommits, type RhHubCommit } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

export function RecruitingCommitBoard(): React.ReactElement {
  const loadCommits = useCallback(() => fetchRecruitingHubCommits(), []);
  const { data, loading, error } = useRecruitingHubQuery<RhHubCommit[]>(loadCommits);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Commit Board</div>
        <div className="rh-section-subtitle">Current UF commits with rating and status.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-commit-board" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-commit-board">
          <p className="rh-empty">{error ? 'Could not load commits.' : 'No commits loaded for this class yet.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-commit-board">
          <p className="rh-empty">No commits loaded for this class yet.</p>
        </section>
      ) : (
        <section className="rh-commit-grid" data-testid="rh-elite-commit-board">
          {data.slice(0, 9).map((c) => (
            <article key={c.id} className="rh-commit-card">
              <div className="rh-commit-header">
                <div>
                  <a href={c.profileUrl} className="rh-commit-name">
                    {c.name}
                  </a>
                  <div className="rh-commit-pos">{c.position}</div>
                </div>
                {c.statusBadge ? <span className="rh-badge">{c.statusBadge}</span> : null}
              </div>
              <div className="rh-commit-body">{c.rankNote}</div>
              <div className="rh-commit-footer">
                <span>Rating {c.rating}</span>
                <span>Committed {c.commitDate}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
