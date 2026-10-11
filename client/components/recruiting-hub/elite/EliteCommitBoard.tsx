'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubCommits, type RhHubCommit } from '@/lib/recruiting-hub-elite-api';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { EliteCommitCard } from '@/components/recruiting-hub/elite/EliteCommitCard';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

type Props = {
  year?: number;
};

/** October 11, 2026 Florida flip. Stale first-paint boards omit him; the live list leads with him. */
const EASTON_ROYAL_COMMIT: RhHubCommit = {
  id: 'easton-royal',
  name: 'Easton Royal',
  position: 'WR',
  rating: '98.4',
  rankNote: '5★ WR · New Orleans, LA · #5 natl · #1 WR · #1 LA',
  metaLine: '5★ WR · New Orleans, LA · #5 natl · #1 WR · #1 LA',
  skinny:
    'Easton Royal flipped from Texas to Florida. 5-star WR, No. 5 nationally, No. 1 at the position.',
  commitDate: 'Oct 11, 2026',
  statusBadge: 'Committed',
  profileUrl: '/vault/recruiting/player/easton-royal',
  enrolled: false,
  inState: false,
  stars: 5,
};

export function leadWithEastonRoyal(year: number, rows: RhHubCommit[] | null | undefined): RhHubCommit[] {
  const list = Array.isArray(rows) ? rows : [];
  if (Number(year) !== 2027) return list;
  const rest = list.filter((row) => String(row?.id || '').toLowerCase() !== 'easton-royal');
  const existing = list.find((row) => String(row?.id || '').toLowerCase() === 'easton-royal');
  return [existing ?? EASTON_ROYAL_COMMIT, ...rest];
}

export function EliteCommitBoard(_props: Props = {}): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const year = _props.year ?? activeYear;
  const selectCommits = useCallback(
    (b: { commits: RhHubCommit[] }) => leadWithEastonRoyal(year, b.commits),
    [year]
  );
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
          {leadWithEastonRoyal(year, data).map((c) => (
            <EliteCommitCard key={c.id} commit={c} year={year} />
          ))}
        </section>
      )}
    </>
  );
}
