import React from 'react';
import { RECRUITING_CLASS_YEARS, ACTIVE_RECRUITING_CLASS_YEAR, classCommitMetricLabel } from '@/lib/recruiting-cycle';
import { recruitingHubHeroSeedForYear } from '@/lib/recruiting-hub-hero-seed';

/** SSR class cards — seeded with real metrics for first paint. */
export function RecruitingHubBootSectionsSsr({
  year = ACTIVE_RECRUITING_CLASS_YEAR,
}: {
  year?: number;
}): React.ReactElement {
  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Recruiting Classes</div>
        <div className="rh-section-subtitle">
          Tap a class to focus the hub on {year} — or open commits for any year.
        </div>
      </div>
      <section className="rh-class-cards" data-testid="rh-class-cards" aria-label="Recruiting class cards">
        <div className="rh-class-cards__grid">
          {RECRUITING_CLASS_YEARS.map((classYear) => {
            const metrics = recruitingHubHeroSeedForYear(classYear);
            const commitLabel = metrics.commitLabel || classCommitMetricLabel(classYear);
            return (
              <article
                key={classYear}
                className={`rh-class-card rh-boot-section${
                  classYear === year ? ' rh-class-card--active' : ''
                }`}
                data-rh-boot={`class-card-${classYear}`}
                data-rh-boot-painted="seed"
                data-testid={`rh-class-card-${classYear}`}
              >
                <div className="rh-class-card__focus">
                  <span className="rh-class-card__watermark" aria-hidden="true">
                    UF
                  </span>
                  <h3 className="rh-class-card__title">{classYear} Class</h3>
                  <dl className="rh-class-card__stats" data-rh-boot-body={`class-card-${classYear}`}>
                    <div>
                      <dt>{commitLabel}</dt>
                      <dd data-rh-field="commits">{metrics.commits}</dd>
                    </div>
                    <div>
                      <dt>Blue chip %</dt>
                      <dd data-rh-field="blue-chip">{metrics.blueChip}</dd>
                    </div>
                    <div>
                      <dt>Avg rating</dt>
                      <dd data-rh-field="avg-rating">{metrics.avgRating}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
