'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RhHubClassOverview } from '@/lib/recruiting-hub-elite-api';
import { fetchClassMetrics } from '@/lib/recruiting-ui-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { RECRUITING_CLASS_YEARS, type RecruitingClassYear, classCommitMetricLabel, classCommitLinkLabel } from '@/lib/recruiting-cycle';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { warmPollProfile } from '@/lib/warm-poll-profile';
import { useRecruitingHubBundleContext } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { readBootClassMetricsByYear, hideRhBootClassCards } from '@/lib/recruiting-hub-boot-read';

function ClassCard({
  year,
  data,
  loading,
  error,
  isActive,
  onFocus,
}: {
  year: RecruitingClassYear;
  data: RhHubClassOverview | null;
  loading: boolean;
  error: boolean;
  isActive: boolean;
  onFocus: (year: RecruitingClassYear) => void;
}): React.ReactElement {
  return (
    <article
      className={`rh-class-card${isActive ? ' rh-class-card--active' : ''}`}
      data-testid={`rh-class-card-${year}`}
      data-active={isActive ? 'true' : 'false'}
    >
      <button
        type="button"
        className="rh-class-card__focus"
        aria-pressed={isActive}
        onClick={() => onFocus(year)}
      >
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
              <dt>{data.commitLabel ?? classCommitMetricLabel(year)}</dt>
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
      </button>
      <Link href={`/vault/recruiting/${year}`} className="rh-class-card__link">
        {classCommitLinkLabel(year)}
      </Link>
    </article>
  );
}

export function ClassCards(): React.ReactElement | null {
  const { activeYear, setActiveYear } = useRecruitingClassYear();
  const { data: bundle, loading: bundleLoading } = useRecruitingHubBundleContext();
  const [byYear, setByYear] = useState<Record<RecruitingClassYear, RhHubClassOverview | null>>(() => {
    const boot = readBootClassMetricsByYear();
    return {
      2026: boot[2026] ?? null,
      2027: boot[2027] ?? null,
      2028: boot[2028] ?? null,
    };
  });
  const [loading, setLoading] = useState(() => !RECRUITING_CLASS_YEARS.some((y) => readBootClassMetricsByYear()[y]));
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = readBootClassMetricsByYear();
    const all = bundle?.classOverviewAll;
    if (all) {
      setByYear({
        2026: all[2026] ?? boot[2026] ?? null,
        2027: all[2027] ?? boot[2027] ?? null,
        2028: all[2028] ?? boot[2028] ?? null,
      });
      setLoading(false);
      setError(false);
      return;
    }

    const hasBoot = RECRUITING_CLASS_YEARS.some((y) => boot[y]);
    setByYear({
      2026: boot[2026] ?? null,
      2027: boot[2027] ?? null,
      2028: boot[2028] ?? null,
    });
    if (bundleLoading) {
      setLoading(!hasBoot);
      return;
    }
    setLoading(!hasBoot);
    setError(false);
    const poll = warmPollProfile();
    void Promise.all(
      RECRUITING_CLASS_YEARS.map((year) =>
        fetchWithWarmPoll(() => fetchClassMetrics(year), poll)
          .then((data) => ({ year, data }))
          .catch(() => ({ year, data: boot[year] ?? null }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next = { 2026: null, 2027: null, 2028: null } as Record<
          RecruitingClassYear,
          RhHubClassOverview | null
        >;
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
  }, [bundle?.classOverviewAll, bundleLoading]);

  useEffect(() => {
    const onBoot = () => {
      const boot = readBootClassMetricsByYear();
      if (!RECRUITING_CLASS_YEARS.some((y) => boot[y])) return;
      setByYear({
        2026: boot[2026] ?? null,
        2027: boot[2027] ?? null,
        2028: boot[2028] ?? null,
      });
      setLoading(false);
    };
    window.addEventListener('gv-hub-boot', onBoot);
    window.addEventListener('gv-hero-boot', onBoot);
    return () => {
      window.removeEventListener('gv-hub-boot', onBoot);
      window.removeEventListener('gv-hero-boot', onBoot);
    };
  }, []);

  const hasAnyData = RECRUITING_CLASS_YEARS.some((y) => byYear[y]);

  useEffect(() => {
    if (hasAnyData) hideRhBootClassCards();
  }, [hasAnyData]);

  if (loading && !hasAnyData) return null;

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Recruiting Classes</div>
        <div className="rh-section-subtitle">
          Tap a class to focus the hub on {activeYear} — or open commits for any year.
        </div>
      </div>
      <section className="rh-class-cards" data-testid="rh-class-cards" aria-label="Recruiting class cards">
        <div className="rh-class-cards__grid">
          {RECRUITING_CLASS_YEARS.map((year) => (
            <ClassCard
              key={year}
              year={year}
              data={byYear[year]}
              loading={loading}
              error={error}
              isActive={year === activeYear}
              onFocus={setActiveYear}
            />
          ))}
        </div>
      </section>
    </>
  );
}
