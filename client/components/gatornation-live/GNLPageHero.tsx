'use client';

import React from 'react';
import { LIVE_HUB_REFRESH_MS } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { SITE_ROUTES } from '@/lib/site-routes';

/** UF Premium GatorNation Live hero — full-width blue gradient, centered copy. */
export function GNLPageHero(): React.ReactElement {
  const seconds = Math.round(LIVE_HUB_REFRESH_MS / 1000);

  return (
    <section
      className="gv-gnl-hero gv-gnl-hero--wireframe"
      aria-label="GatorNation Live hero"
      data-testid="gnl-page-hero"
    >
      <div className="gv-gnl-hero__bg" aria-hidden="true" />
      <div className="gv-gnl-hero__overlay" aria-hidden="true" />

      <div className="gv-gnl__frame gv-gnl-hero__inner gv-gnl-hero__inner--centered gv-gnl-hero__inner--fade-in">
        <span className="gv-gnl-hero__title-accent gv-gnl-hero__title-accent--top" aria-hidden="true" />
        <h1 className="gv-gnl-hero__title gv-gnl-hero__title--wireframe">
          <a href={SITE_ROUTES.gatorNationLive} className="gv-gnl-hero__title-link">
            {GNL_COPY.hero.title}
          </a>
        </h1>
        <p className="gv-gnl-hero__subtitle gv-gnl-hero__subtitle--wireframe">{GNL_COPY.hero.subtitle}</p>
        <p className="gv-gnl-hero__live-badge" aria-live="polite">
          <span className="gv-gnl-hero__live-dot" aria-hidden="true" />
          {GNL_COPY.hero.liveBadge(seconds)}
        </p>
      </div>

      <div className="gv-gnl-hero__energy-bar" aria-hidden="true" />
    </section>
  );
}
