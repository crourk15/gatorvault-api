'use client';

import React from 'react';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { SITE_ROUTES } from '@/lib/site-routes';

/** UF Premium GatorNation Live hero — solid Gator Blue, centered copy. */
export function GNLPageHero(): React.ReactElement {
  return (
    <section
      className="gv-gnl-hero gv-gnl-hero--wireframe gv-gnl-hero--redesign"
      aria-label="GatorNation Live hero"
      data-testid="gnl-page-hero"
    >
      <div className="gv-gnl-hero__bg" aria-hidden="true" />

      <div className="gv-gnl__frame gv-gnl-hero__inner gv-gnl-hero__inner--centered gv-gnl-hero__inner--fade-in">
        <span className="gv-gnl-hero__title-accent gv-gnl-hero__title-accent--top" aria-hidden="true" />
        <h1 className="gv-gnl-hero__title gv-gnl-hero__title--wireframe">
          <a href={SITE_ROUTES.gatorNationLive} className="gv-gnl-hero__title-link">
            {GNL_COPY.hero.title}
          </a>
        </h1>
        <p className="gv-gnl-hero__subtitle gv-gnl-hero__subtitle--wireframe">{GNL_COPY.hero.subtitle}</p>
        <p className="gv-gnl-hero__meta">{GNL_COPY.hero.meta}</p>
      </div>
    </section>
  );
}
