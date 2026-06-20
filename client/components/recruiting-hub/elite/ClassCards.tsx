'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { fetchRecruitingHubClassOverview, type RhHubClassOverview } from '@/lib/recruiting-hub-elite-api';
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

function useClassOverview(year: ClassYear) {
  const load = useCallback(() => fetchRecruitingHubClassOverview(year), [year]);
  return useRecruitingHubQuery<RhHubClassOverview>(load);
}

export function ClassCards(): React.ReactElement {
  const y2026 = useClassOverview(2026);
  const y2027 = useClassOverview(2027);
  const y2028 = useClassOverview(2028);
  const byYear: Record<ClassYear, ReturnType<typeof useClassOverview>> = {
    2026: y2026,
    2027: y2027,
    2028: y2028,
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
              data={byYear[year].data}
              loading={byYear[year].loading}
              error={byYear[year].error}
            />
          ))}
        </div>
      </section>
    </>
  );
}
