import React from 'react';
import { RECRUITING_CLASS_YEARS, ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

/** SSR class cards — painted by recruiting-hub-hero-boot before React hydrates. */
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
          {RECRUITING_CLASS_YEARS.map((classYear) => (
            <article
              key={classYear}
              className={`rh-class-card rh-boot-section rh-boot-loading${
                classYear === year ? ' rh-class-card--active' : ''
              }`}
              data-rh-boot={`class-card-${classYear}`}
              data-testid={`rh-class-card-${classYear}`}
            >
              <div className="rh-class-card__focus">
                <span className="rh-class-card__watermark" aria-hidden="true">
                  UF
                </span>
                <h3 className="rh-class-card__title">{classYear} Class</h3>
                <dl className="rh-class-card__stats" data-rh-boot-body={`class-card-${classYear}`}>
                  <div>
                    <dt>Commits</dt>
                    <dd data-rh-field="commits">—</dd>
                  </div>
                  <div>
                    <dt>Blue chip %</dt>
                    <dd data-rh-field="blue-chip">—</dd>
                  </div>
                  <div>
                    <dt>Avg rating</dt>
                    <dd data-rh-field="avg-rating">—</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
