'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import {
  fetchRecruitingHubClassOverviewAll,
  type RhHubClassOverview,
  type RhHubClassOverviewByYear,
} from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

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
  const load = useCallback(() => fetchRecruitingHubClassOverviewAll(), []);
  const { data: allClasses, loading, error } = useRecruitingHubQuery<RhHubClassOverviewByYear>(load);
  const byYear: Record<ClassYear, RhHubClassOverview | null> = {
    2026: allClasses?.[2026] ?? null,
    2027: allClasses?.[2027] ?? null,
    2028: allClasses?.[2028] ?? null,
  };

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
