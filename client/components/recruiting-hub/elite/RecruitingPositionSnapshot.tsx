'use client';

import React, { useEffect, useState } from 'react';
import type { RhHubPositionRoom } from '@/lib/recruiting-hub-elite-api';
import { fetchPositionSnapshot } from '@/lib/recruiting-ui-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';

export function RecruitingPositionSnapshot(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const [data, setData] = useState<RhHubPositionRoom[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);
    void fetchPositionSnapshot(activeYear)
      .then((res) => {
        if (!cancelled) setData(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeYear]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Position Room Snapshot</div>
        <div className="rh-section-subtitle">{activeYear} class — commits and key targets by position.</div>
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
