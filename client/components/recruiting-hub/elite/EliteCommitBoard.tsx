'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubCommits, type RhHubCommit } from '@/lib/recruiting-hub-elite-api';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { EliteCommitCard } from '@/components/recruiting-hub/elite/EliteCommitCard';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

type Props = {
  year?: number;
};

/** Stale first-paint boards can omit him; insert at national rank, never first. */
const EASTON_ROYAL_COMMIT: RhHubCommit = {
  id: 'easton-royal',
  name: 'Easton Royal',
  position: 'WR',
  rating: '98.3',
  rankNote: '5★ WR · New Orleans, LA · #7 natl · #1 WR · #1 LA',
  metaLine: '5★ WR · New Orleans, LA · #7 natl · #1 WR · #1 LA',
  skinny:
    'Easton Royal flipped from Texas to Florida. 5-star WR, No. 7 nationally, No. 1 at the position.',
  commitDate: 'Oct 11, 2026',
  statusBadge: 'Committed',
  profileUrl: '/vault/recruiting/player/easton-royal',
  enrolled: false,
  inState: false,
  stars: 5,
  natlRank: 7,
};

function commitNatlRank(row: RhHubCommit | null | undefined): number {
  const n = Number(row?.natlRank);
  if (Number.isFinite(n) && n > 0) return n;
  const m = String(row?.rankNote || row?.metaLine || '').match(/#(\d+)\s+natl/i);
  if (m) return Number(m[1]);
  return 9999;
}

function commitRating(row: RhHubCommit | null | undefined): number {
  const n = Number(row?.rating);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Commit cards paint in On3 Industry national-rank order. */
export function sortCommitsByNatlRank(year: number, rows: RhHubCommit[] | null | undefined): RhHubCommit[] {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (Number(year) === 2027 && !list.some((row) => String(row?.id || '').toLowerCase() === 'easton-royal')) {
    list.push(EASTON_ROYAL_COMMIT);
  }
  return list
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const rank = commitNatlRank(a.row) - commitNatlRank(b.row);
      if (rank) return rank;
      const rating = commitRating(b.row) - commitRating(a.row);
      if (rating) return rating;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function EliteCommitBoard(_props: Props = {}): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const year = _props.year ?? activeYear;
  const selectCommits = useCallback(
    (b: { commits: RhHubCommit[] }) => sortCommitsByNatlRank(year, b.commits),
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
          {sortCommitsByNatlRank(year, data).map((c) => (
            <EliteCommitCard key={c.id} commit={c} year={year} />
          ))}
        </section>
      )}
    </>
  );
}
