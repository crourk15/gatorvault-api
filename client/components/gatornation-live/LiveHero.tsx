'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { LIVE_HUB_REFRESH_MS } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';

export function LiveHero(): React.ReactElement {
  const seconds = Math.round(LIVE_HUB_REFRESH_MS / 1000);

  return (
    <section
      className="gv-gnl-hero gv-texture-stadium-lights gv-texture-swamp-mist"
      aria-label="GatorNation Live hero"
    >
      <div className="gv-gnl-hero__bg" aria-hidden="true" />
      <div className="gv-gnl-hero__inner gv-gnl__frame">
        <GatorVaultWordmark height={28} className="gv-gnl-hero__wordmark" />
        <h1 className="gv-gnl-hero__title">{GNL_COPY.hero.title}</h1>
        <p className="gv-gnl-hero__subtitle">{GNL_COPY.hero.subtitle}</p>
        <p className="gv-gnl-hero__badge" aria-live="polite">
          <span className="gv-gnl-hero__badge-dot" aria-hidden="true" />
          {GNL_COPY.hero.liveBadge(seconds)}
        </p>
      </div>
    </section>
  );
}
