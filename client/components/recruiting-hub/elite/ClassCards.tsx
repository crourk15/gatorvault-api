'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RhHubClassOverview } from '@/lib/recruiting-hub-elite-api';
import { fetchClassMetrics } from '@/lib/recruiting-ui-api';

const CLASS_YEARS = [2026, 2027, 2028] as const;

type ClassYear = (typeof CLASS_YEARS)[number];

function ClassCard({
  year,
  data,
  loading,
  error,
}: {
  year: ClassYear;
  data: RhHubClassOverview | null;
  loading: boolean;
  error: boolean;
}): React.ReactElement {
  return (
    <article className="rh-class-card" data-testid={`rh-class-card-${year}`}>
      <span className="rh-class-card__watermark" aria-hidden="true">
        UF
      </span>
      <h3 className="rh-class-card__title">{year} Class</h3>
      {loading ? (
        <div className="rh-skeleton rh-class-card__skeleton" aria-hidden="true" />
      ) : !data ? (
        <p className="rh-empty">{error ? 'Could not load class data.' : 'Class data unavailable.'}</p>
      ) : (
        <dl className="rh-class-card__stats">
          <div>
            <dt>Commits</dt>
            <dd>{data.commits}</dd>
          </div>
          <div>
            <dt>Blue chip %</dt>
            <dd>{data.blueChip}</dd>
          </div>
          <div>
            <dt>Avg rating</dt>
            <dd>{data.avgRating}</dd>
          </div>
        </dl>
      )}
      <Link href={`/vault/recruiting/${year}`} className="rh-class-card__link">
        View commits →
      </Link>
    </article>
  );
}

export function ClassCards(): React.ReactElement {
  const [byYear, setByYear] = useState<Record<ClassYear, RhHubClassOverview | null>>({
    2026: null,
    2027: null,
    2028: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void Promise.all(
      CLASS_YEARS.map((year) =>
        fetchClassMetrics(year)
          .then((data) => ({ year, data }))
          .catch(() => ({ year, data: null }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next = { 2026: null, 2027: null, 2028: null } as Record<ClassYear, RhHubClassOverview | null>;
        for (const { year, data } of results) {
          next[year] = data;
        }
        setByYear(next);
        setError(results.every((r) => !r.data));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Recruiting Classes</div>
        <div className="rh-section-subtitle">Quick access to each class overview.</div>
      </div>
      <section className="rh-class-cards" data-testid="rh-class-cards" aria-label="Recruiting class cards">
        <div className="rh-class-cards__grid">
          {CLASS_YEARS.map((year) => (
            <ClassCard
              key={year}
              year={year}
              data={byYear[year]}
              loading={loading}
              error={error}
            />
          ))}
        </div>
      </section>
    </>
  );
}
