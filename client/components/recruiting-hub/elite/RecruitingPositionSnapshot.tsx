'use client';

import React, { useCallback } from 'react';
import type { RhHubPositionRoom } from '@/lib/recruiting-hub-elite-api';
import { fetchPositionSnapshot } from '@/lib/recruiting-ui-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function RecruitingPositionSnapshot(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const selectPositions = useCallback((b: { positions: RhHubPositionRoom[] }) => b.positions, []);
  const fetchPositions = useCallback(async (year: number) => {
    const res = await fetchPositionSnapshot(year);
    return res.items ?? [];
  }, []);
  const { data, loading, error } = useHubBundleSection({
    select: selectPositions,
    fetchFallback: fetchPositions,
  });

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Position Room Snapshot</div>
        <div className="rh-section-subtitle">
          {activeYear} class — commits and key targets by position.
        </div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-position-snapshot" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-position-snapshot">
          <p className="rh-empty">{error ? 'Could not load position snapshot.' : 'Position breakdown unavailable.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-position-snapshot">
          <p className="rh-empty">No position totals for this class yet.</p>
        </section>
      ) : (
        <section className="rh-position-grid" data-testid="rh-elite-position-snapshot">
          {data.map((p) => (
            <article key={p.id} className="rh-position-card">
              <div className="rh-position-label">{p.label}</div>
              <div className="rh-position-meta">
                {countLabel(p.commits, 'commit', 'commits')}
                {' · '}
                {countLabel(p.targets, 'key target', 'key targets')}
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
