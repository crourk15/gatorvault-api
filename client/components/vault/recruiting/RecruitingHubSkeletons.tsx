'use client';

import React from 'react';

type GridProps = {
  count?: number;
  columns?: 2 | 3;
};

export function RecruitingIntelSkeleton({ count = 4 }: { count?: number }): React.ReactElement {
  return (
    <div className="gv-rh-intel__grid" data-testid="rh-intel-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="gv-rh-skeleton gv-rh-skeleton--intel" />
      ))}
    </div>
  );
}

export function RecruitingCommitsSkeleton({ count = 6, columns = 3 }: GridProps): React.ReactElement {
  const colClass = columns === 2 ? ' gv-rh-commits-grid--2' : '';
  return (
    <div className={`gv-rh-commits-grid${colClass}`} data-testid="rh-commits-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="gv-rh-skeleton gv-rh-skeleton--commit" />
      ))}
    </div>
  );
}
