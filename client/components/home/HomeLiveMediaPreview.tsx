'use client';

import React from 'react';
import { InViewObserver } from '@/components/home/InViewObserver';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeLiveMediaPreview(): React.ReactElement {
  return (
    <InViewObserver className="gv-card gv-card--fade-in gv-card--media" visibleClass="gv-card--visible">
      <div data-testid="home-live-media">
      <div className="gv-card__header">
        <div className="gv-card__title">GatorNation Live</div>
        <div className="gv-card__meta">Beat writers, commits, and live recruiting pulse</div>
      </div>
      <div className="gv-card__body">
        <a href={SITE_ROUTES.community} className="gv-media-row">
          <div className="gv-media-row__icon" aria-hidden>
            📡
          </div>
          <div className="gv-media-row__text">Open Live Hub →</div>
        </a>
      </div>
      </div>
    </InViewObserver>
  );
}
