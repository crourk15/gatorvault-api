import React from 'react';
import { recruitingHubHeroBootScript, RECRUITING_HUB_HERO_YEAR } from '@/lib/recruiting-hub-hero-boot';

const CLASS_YEARS = [2026, 2027, 2028] as const;

/** Server-rendered hero partial — visible before JS bundle; hydrated after bundle via __GV_HYDRATE__. */
export function RecruitingHubHeroSsr({
  year = RECRUITING_HUB_HERO_YEAR,
}: {
  year?: number;
}): React.ReactElement {
  return (
    <>
      <section
        className="rh-hero-strip hero-skeleton"
        data-hydrate="hero"
        aria-label="Recruiting Command Center"
      >
        <div className="rh-hero-sweep" aria-hidden="true" />
        <div className="rh-hero-watermark" aria-hidden="true">
          GATORS
        </div>
        <div className="rh-hero-top">
          <div>
            <div className="rh-hero-title" data-hero-field="title">
              Recruiting Command Center
            </div>
            <div className="rh-hero-subtitle" data-hero-field="subtitle">
              UF&apos;s class, commits, and battles—one place.
            </div>
            <div className="rh-hero-year-tabs" data-hero-field="year-tabs" role="tablist" aria-label="Class year">
              {CLASS_YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`rh-hero-year-tab${y === year ? ' is-active' : ''}`}
                  data-year={y}
                  disabled
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <span className="rh-badge rh-hero-badge">Command Center</span>
        </div>
        <div className="rh-hero-metrics hero-skeleton__metrics" aria-label="Class summary metrics">
          <div className="rh-hero-metric">
            <span className="rh-hero-metric__label">Class rank</span>
            <span className="rh-hero-metric__value" data-hero-metric="class-rank">
              —
            </span>
          </div>
          <div className="rh-hero-metric">
            <span className="rh-hero-metric__label">Blue chip %</span>
            <span className="rh-hero-metric__value" data-hero-metric="blue-chip">
              —
            </span>
          </div>
          <div className="rh-hero-metric">
            <span className="rh-hero-metric__label">Commits</span>
            <span className="rh-hero-metric__value" data-hero-metric="commits">
              —
            </span>
          </div>
          <div className="rh-hero-metric">
            <span className="rh-hero-metric__label">Avg rating</span>
            <span className="rh-hero-metric__value" data-hero-metric="avg-rating">
              —
            </span>
          </div>
        </div>
      </section>
      <script
        dangerouslySetInnerHTML={{
          __html: recruitingHubHeroBootScript(year),
        }}
      />
    </>
  );
}
