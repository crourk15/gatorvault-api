'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  useRecruitingHubBundleContext,
  RecruitingHubBundleProvider,
  type RecruitingHubBundleState,
} from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { RECRUITING_HUB_ELITE_YEAR } from '@/lib/recruiting-hub-elite-api';
import type { RhHubClassOverview, RhHubHeroPayload } from '@/lib/recruiting-hub-elite-api';
import { fetchClassMetrics } from '@/lib/recruiting-ui-api';
import {
  isRecruitingClassYearUserPinned,
  setRecruitingClassYearStore,
  useRecruitingClassYear,
} from '@/lib/recruiting-class-year-store';
import { RECRUITING_CLASS_YEARS, parseRecruitingClassYear, classCommitMetricLabel } from '@/lib/recruiting-cycle';
import { initGvHydrate, scheduleHeroHydration, releaseHeroHydrationGate } from '@/lib/gv-hydrate';
import '@/lib/recruiting-hub-window';

const CLASS_YEARS = RECRUITING_CLASS_YEARS;
/** Module-level: hero window seed runs at most once per page load. */
let heroYearSeeded = false;

function heroFromWindow(): RhHubHeroPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.__GV_HERO__ ?? null;
  if (!raw) return null;
  const title = String(raw.title || '');
  const subtitle = String(raw.subtitle || '');
  return {
    ...raw,
    title: /command\s*center/i.test(title) ? 'Florida Recruiting' : title || 'Florida Recruiting',
    subtitle: /command\s*center/i.test(subtitle)
      ? 'Who Florida is chasing — movement, board, and beat intel.'
      : subtitle || 'Who Florida is chasing — movement, board, and beat intel.',
  };
}


function HeroMetric({
  label,
  value,
  metric,
}: {
  label: string;
  value: string;
  metric: string;
}): React.ReactElement {
  return (
    <div className="rh-hero-metric">
      <span className="rh-hero-metric__label">{label}</span>
      <span className="rh-hero-metric__value" data-hero-metric={metric}>
        {value}
      </span>
    </div>
  );
}

function HeroMetrics({
  overview,
  activeYear,
}: {
  overview: RhHubClassOverview | null | undefined;
  activeYear: number;
}): React.ReactElement {
  const commitLabel = overview?.commitLabel ?? classCommitMetricLabel(activeYear);
  return (
    <div className="rh-hero-metrics" aria-label="Class summary metrics">
      <HeroMetric label="Class rank" metric="class-rank" value={overview?.classRank ?? '—'} />
      <HeroMetric label="Blue chip %" metric="blue-chip" value={overview?.blueChip ?? '—'} />
      <HeroMetric label={commitLabel} metric="commits" value={overview?.commits ?? '—'} />
      <HeroMetric label="Avg rating" metric="avg-rating" value={overview?.avgRating ?? '—'} />
    </div>
  );
}

type RecruitingHeroStripProps = {
  year?: number;
};

export function RecruitingHeroStrip({ year = RECRUITING_HUB_ELITE_YEAR }: RecruitingHeroStripProps): React.ReactElement {
  const { data } = useRecruitingHubBundleContext();
  const { activeYear, setActiveYear } = useRecruitingClassYear();
  const seeded = heroFromWindow();
  const [yearOverview, setYearOverview] = useState<RhHubClassOverview | null>(
    () => seeded?.classOverview ?? null
  );
  const [metricsLoading, setMetricsLoading] = useState(() => !seeded?.classOverview);

  useEffect(() => {
    // Route prop seed only — never override a user year tap.
    if (year !== RECRUITING_HUB_ELITE_YEAR) {
      setRecruitingClassYearStore(parseRecruitingClassYear(year));
    }
  }, [year]);

  useEffect(() => {
    if (heroYearSeeded || isRecruitingClassYearUserPinned()) return;
    if (!seeded?.year) return;
    heroYearSeeded = true;
    setRecruitingClassYearStore(parseRecruitingClassYear(seeded.year));
  }, [seeded?.year]);

  useEffect(() => {
    let cancelled = false;
    const fromBundle =
      data?.year === activeYear
        ? data.classOverview
        : data?.classOverviewAll?.[activeYear as 2026 | 2027 | 2028];
    if (fromBundle) {
      setYearOverview(fromBundle);
      setMetricsLoading(false);
      return;
    }

    const hasSeed =
      seeded?.classOverview && parseRecruitingClassYear(seeded.year ?? year) === activeYear;
    if (!hasSeed) setMetricsLoading(true);
    void fetchClassMetrics(activeYear)
      .then((res) => {
        if (!cancelled) setYearOverview(res);
      })
      .catch(() => {
        if (!cancelled) setYearOverview(null);
      })
      .finally(() => {
        if (!cancelled) setMetricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeYear, data?.classOverview, data?.classOverviewAll, data?.year, seeded?.classOverview, seeded?.year, year]);

  const overview =
    yearOverview ??
    (data?.year === activeYear ? data.classOverview : data?.classOverviewAll?.[activeYear as 2026 | 2027 | 2028]) ??
    seeded?.classOverview ??
    null;
  const title = seeded?.title ?? 'Florida Recruiting';
  const bundleSubtitle = String(data?.subtitle || '').trim();
  const subtitle =
    (bundleSubtitle && !/command\s*center/i.test(bundleSubtitle) ? bundleSubtitle : '') ||
    seeded?.subtitle ||
    'Who Florida is chasing — movement, board, and beat intel.';

  const handleYear = useCallback(
    (nextYear: number) => {
      setActiveYear(parseRecruitingClassYear(nextYear));
    },
    [setActiveYear]
  );

  return (
    <section className="rh-hero-strip" data-hydrate="hero" data-hydrated="true" aria-label="Florida Recruiting">
      <div className="rh-hero-sweep" aria-hidden="true" />
      <div className="rh-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <div className="rh-hero-top">
        <div>
          <div className="rh-hero-title" data-hero-field="title">
            {title}
          </div>
          <div className="rh-hero-subtitle" data-hero-field="subtitle">
            {subtitle}
          </div>
          <div className="rh-hero-year-tabs" role="tablist" aria-label="Class year">
            {CLASS_YEARS.map((y) => (
              <button
                key={y}
                type="button"
                role="tab"
                aria-selected={y === activeYear}
                className={`rh-hero-year-tab${y === activeYear ? ' is-active' : ''}`}
                onClick={() => handleYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <span className="rh-badge rh-hero-badge">Live</span>
      </div>
      <HeroMetrics overview={metricsLoading && !overview ? null : overview} activeYear={activeYear} />
    </section>
  );
}

let heroRoot: Root | null = null;

/**
 * Mount the hero, then paint again when the live bundle replaces the seed.
 * The first pass often still holds the August class line (#8 / 26 / 89.9).
 * Skipping a host that is already marked hydrated left that line on screen.
 */
export function hydrateRecruitingHero(bundleState: RecruitingHubBundleState): void {
  const freshHost = document.querySelector('[data-hydrate="hero"]:not([data-hydrated="true"])');
  const host = freshHost || (heroRoot ? document.querySelector('[data-hydrate="hero"]') : null);
  if (!host) {
    releaseHeroHydrationGate('hero-host-missing');
    return;
  }

  const t0 = performance.now();
  const mountHost = freshHost || host;
  if (!heroRoot || freshHost) {
    heroRoot?.unmount();
    heroRoot = createRoot(mountHost);
  }
  const root = heroRoot;
  if (!root) {
    releaseHeroHydrationGate('hero-host-missing');
    return;
  }
  root.render(
    <RecruitingHubBundleProvider value={bundleState}>
      <RecruitingHeroStrip />
    </RecruitingHubBundleProvider>
  );
  host.setAttribute('data-hydrated', 'true');
  host.classList.remove('hero-skeleton');
  releaseHeroHydrationGate('hydrated');

  const hydrationMs = Math.round(performance.now() - t0);
  const hub = window.__GV_HUB__;
  if (hub) {
    hub.hydrationMs = hydrationMs;
    if (hub.bundleLoadMs != null && hub.start != null) {
      hub.bundleToHeroMs = Math.round(performance.now() - hub.start - hub.bundleLoadMs);
    }
  }
}

/** Register hero hydration — runs after bundle fetch via RecruitingHubElite. */
export function RecruitingHeroHydrator(): null {
  const bundle = useRecruitingHubBundleContext();

  useEffect(() => {
    initGvHydrate();
  }, []);

  useEffect(() => {
    const seededHero = heroFromWindow();
    if (bundle.loading && !seededHero?.classOverview) return;
    scheduleHeroHydration(() => hydrateRecruitingHero(bundle));
  }, [bundle.loading, bundle.data, bundle.error]);

  return null;
}

/** Inline hero when SSR partial is not present (class year pages). */
export function RecruitingHeroStripInline(): React.ReactElement {
  return <RecruitingHeroStrip />;
}
