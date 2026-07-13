'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubCommits, type RhHubCommit } from '@/lib/recruiting-hub-elite-api';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { EliteCommitCard } from '@/components/recruiting-hub/elite/EliteCommitCard';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

type Props = {
  year?: number;
};

export function EliteCommitBoard(_props: Props = {}): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const year = _props.year ?? activeYear;
  const selectCommits = useCallback((b: { commits: RhHubCommit[] }) => b.commits, []);
  const fetchCommits = useCallback((y: number) => fetchRecruitingHubCommits(y), []);
  const { data, loading, error } = useHubBundleSection({
    select: selectCommits,
    fetchFallback: fetchCommits,
  });

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">{year} Commit Class</div>
        <div className="rh-section-subtitle">
          Every Florida signing-class commit — who they are and why the get matters.
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
