'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubCommits } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';
import { EliteCommitCard } from '@/components/recruiting-hub/elite/EliteCommitCard';

type Props = {
  year: number;
};

export function EliteCommitBoard({ year }: Props): React.ReactElement {
  const loadCommits = useCallback(() => fetchRecruitingHubCommits(year), [year]);
  const { data, loading, error } = useRecruitingHubQuery(loadCommits);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">{year} Commit Class</div>
        <div className="rh-section-subtitle">
          Every Florida commit — who they are and why the get matters.
        </div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid={`rh-elite-commit-board-${year}`} aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid={`rh-elite-commit-board-${year}`}>
          <p className="rh-empty">{error ? 'Could not load commits.' : 'No commits loaded for this class yet.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid={`rh-elite-commit-board-${year}`}>
          <p className="rh-empty">No commits loaded for this class yet.</p>
        </section>
      ) : (
        <section className="rh-commit-grid" data-testid={`rh-elite-commit-board-${year}`}>
          {data.map((c) => (
            <EliteCommitCard key={c.id} commit={c} year={year} />
          ))}
        </section>
      )}
    </>
  );
}
