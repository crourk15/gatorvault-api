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
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { RECRUITING_CLASS_YEARS, parseRecruitingClassYear } from '@/lib/recruiting-cycle';
import { initGvHydrate, scheduleHeroHydration, releaseHeroHydrationGate } from '@/lib/gv-hydrate';
import '@/lib/recruiting-hub-window';

const FALLBACK_TICKER = [
  '2027 class trending nationally — UF in the mix',
  'Blue chip % rising on the board',
  'Staff locked in for summer evals',
  'Battles heating up — movement intel live',
];

const CLASS_YEARS = RECRUITING_CLASS_YEARS;

function heroFromWindow(): RhHubHeroPayload | null {
  if (typeof window === 'undefined') return null;
  return window.__GV_HERO__ ?? null;
}

function HeroMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rh-hero-metric">
      <span className="rh-hero-metric__label">{label}</span>
      <span className="rh-hero-metric__value">{value}</span>
    </div>
  );
}

function HeroMetrics({ overview }: { overview: RhHubClassOverview | null | undefined }): React.ReactElement {
  return (
    <div className="rh-hero-metrics" aria-label="Class summary metrics">
      <HeroMetric label="Class rank" value={overview?.classRank ?? '—'} />
      <HeroMetric label="Blue chip %" value={overview?.blueChip ?? '—'} />
      <HeroMetric label="Commits" value={overview?.commits ?? '—'} />
      <HeroMetric label="Avg rating" value={overview?.avgRating ?? '—'} />
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
    if (year !== RECRUITING_HUB_ELITE_YEAR) setActiveYear(parseRecruitingClassYear(year));
  }, [year, setActiveYear]);

  useEffect(() => {
    if (seeded?.year) setActiveYear(parseRecruitingClassYear(seeded.year));
  }, [seeded?.year, setActiveYear]);

  useEffect(() => {
    let cancelled = false;
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
  }, [activeYear]);

  const tickerItems = data?.ticker?.length
    ? data.ticker
    : seeded?.ticker?.length
      ? seeded.ticker
      : FALLBACK_TICKER;
  const overview =
    yearOverview ?? data?.classOverview ?? seeded?.classOverview ?? null;
  const title = seeded?.title ?? 'Recruiting Command Center';
  const subtitle = seeded?.subtitle ?? "UF's class, movement, and battles—one place.";

  const handleYear = useCallback(
    (nextYear: number) => {
      setActiveYear(parseRecruitingClassYear(nextYear));
    },
    [setActiveYear]
  );

  return (
    <section className="rh-hero-strip" data-hydrate="hero" data-hydrated="true" aria-label="Recruiting War Room">
      <div className="rh-hero-sweep" aria-hidden="true" />
      <div className="rh-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <div className="rh-hero-top">
        <div>
          <div className="rh-hero-title">{title}</div>
          <div className="rh-hero-subtitle">{subtitle}</div>
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
        <span className="rh-badge rh-hero-badge rh-hero-badge--pulse">WAR ROOM</span>
      </div>
      <HeroMetrics overview={metricsLoading && !overview ? null : overview} />
      <div className="rh-hero-ticker" aria-label="Recruiting intel ticker">
        <div className="rh-hero-ticker-track">
          {tickerItems.map((item, idx) => (
            <span key={idx} className="rh-hero-ticker-item">
              {item}
              <span className="rh-hero-ticker-sep">·</span>
            </span>
          ))}
          {tickerItems.map((item, idx) => (
            <span key={`dup-${idx}`} className="rh-hero-ticker-item">
              {item}
              <span className="rh-hero-ticker-sep">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

let heroRoot: Root | null = null;

/** Mount interactive hero into SSR shell after bundle loads. */
export function hydrateRecruitingHero(bundleState: RecruitingHubBundleState): void {
  const host = document.querySelector('[data-hydrate="hero"]:not([data-hydrated="true"])');
  if (!host) {
    releaseHeroHydrationGate('hero-host-missing');
    return;
  }

  const t0 = performance.now();
  heroRoot?.unmount();
  heroRoot = createRoot(host);
  heroRoot.render(
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
