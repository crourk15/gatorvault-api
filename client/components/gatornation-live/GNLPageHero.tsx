'use client';

import React from 'react';
import { LIVE_HUB_REFRESH_MS } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';

/** Top-anchored GatorNation Live hero — Dashboard blueprint pattern. */
export function GNLPageHero(): React.ReactElement {
  const seconds = Math.round(LIVE_HUB_REFRESH_MS / 1000);

  return (
    <section
      className="gv-gnl-hero gv-texture-stadium-lights"
      aria-label="GatorNation Live hero"
      data-testid="gnl-page-hero"
    >
      <div className="gv-gnl-hero__bg" aria-hidden="true" />
      <div className="gv-gnl-hero__overlay" aria-hidden="true" />

      <div className="gv-gnl__frame gv-gnl-hero__inner">
        <p className="gv-gnl-hero__eyebrow">
          <span className="gv-gnl-hero__live-dot" aria-hidden="true" />
          ESPN-style live pulse
        </p>
        <h1 className="gv-gnl-hero__title">
          {GNL_COPY.hero.title}
          <span className="gv-gnl-hero__title-accent" aria-hidden="true" />
        </h1>
        <p className="gv-gnl-hero__subtitle">{GNL_COPY.hero.subtitle}</p>
        <p className="gv-gnl-hero__live-badge" aria-live="polite">
          {GNL_COPY.hero.liveBadge(seconds)}
        </p>
      </div>

      <div className="gv-gnl-hero__energy-bar" aria-hidden="true" />
    </section>
  );
}
