'use client';

import React from 'react';
import { LIVE_HUB_REFRESH_MS } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';

/** Compact live pulse — replaces the full gradient page hero. */
export function GNLLivePulse(): React.ReactElement {
  const seconds = Math.round(LIVE_HUB_REFRESH_MS / 1000);

  return (
    <article className="gv-gnl-card gv-gnl-pulse" aria-label="Live pulse" data-testid="gnl-live-pulse">
      <div className="gv-gnl-pulse__row">
        <p className="gv-gnl-pulse__badge">
          <span className="gv-gnl-hero__live-dot" aria-hidden="true" />
          {GNL_COPY.hero.liveBadge(seconds)}
        </p>
        <h1 className="gv-gnl-pulse__title">{GNL_COPY.hero.title}</h1>
        <p className="gv-gnl-pulse__subtitle">{GNL_COPY.hero.subtitle}</p>
      </div>
    </article>
  );
}
