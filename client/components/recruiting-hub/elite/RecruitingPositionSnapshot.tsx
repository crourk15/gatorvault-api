'use client';

import React, { useCallback } from 'react';
import { fetchRecruitingHubPositions, type RhHubPositionRoom } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

export function RecruitingPositionSnapshot(): React.ReactElement {
  const loadPositions = useCallback(() => fetchRecruitingHubPositions(), []);
  const { data, loading, error } = useRecruitingHubQuery<RhHubPositionRoom[]>(loadPositions);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Position Room Snapshot</div>
        <div className="rh-section-subtitle">Commits and key targets by position.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-position-snapshot" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-position-snapshot">
          <p className="rh-empty">{error ? 'Could not load position snapshot.' : 'Position breakdown unavailable.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-position-snapshot">
          <p className="rh-empty">Position breakdown loading.</p>
        </section>
      ) : (
        <section className="rh-position-grid" data-testid="rh-elite-position-snapshot">
          {data.map((p) => (
            <article key={p.id} className="rh-position-card">
              <div className="rh-position-label">{p.label}</div>
              <div className="rh-position-meta">
                {p.commits} commits · {p.targets} key targets
              </div>
              <div className="rh-metric-trend">{p.note}</div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
