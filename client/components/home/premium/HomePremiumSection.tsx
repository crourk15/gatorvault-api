'use client';

import React from 'react';

type Props = {
  title: string;
  ctaLabel?: string;
  ctaHref?: string;
  badge?: React.ReactNode;
  count?: string;
  children: React.ReactNode;
  testId?: string;
};

/** Wireframe section shell — header, orange underline, module grid, optional CTA. */
export function HomePremiumSection({
  title,
  ctaLabel,
  ctaHref,
  badge,
  count,
  children,
  testId,
}: Props): React.ReactElement {
  return (
    <section className="uf-premium-section" data-testid={testId}>
      <header className="uf-premium-section__head">
        <div className="uf-premium-section__title-row">
          <h2 className="uf-premium-section__title">{title}</h2>
          {(badge || count) && (
            <div className="uf-premium-section__badges">
              {badge}
              {count ? <span className="uf-premium-section__count">{count}</span> : null}
            </div>
          )}
        </div>
        <span className="uf-premium-section__underline" aria-hidden="true" />
      </header>
      <div className="uf-premium-section__modules">{children}</div>
      {ctaLabel && ctaHref ? (
        <div className="uf-premium-section__cta">
          <a href={ctaHref} className="uf-premium-cta uf-premium-cta--primary">
            {ctaLabel}
          </a>
        </div>
      ) : null}
    </section>
  );
}
