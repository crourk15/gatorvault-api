'use client';

import React from 'react';
import type { TickerResponse } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import './HomeGatorNationPreview.css';

type Props = {
  ticker: TickerResponse | null;
};

export function HomeGatorNationPreview({ ticker }: Props): React.ReactElement {
  const items = (ticker?.items ?? []).slice(0, 5);
  const hot = ticker?.hotToday?.slice(0, 3) ?? [];

  return (
    <article
      className="gv-home__cell gv-home__cell--12 gv-home-panel gv-home-card gv-home-gnl-preview"
      aria-label="GatorNation Live preview"
      data-testid="home-gnl-preview"
    >
      <div className="gv-home-gnl-preview__hero" aria-hidden="true" />
      <p className="gv-home-card__eyebrow">
        <span className="gv-home-live-dot" aria-hidden="true" />
        GatorNation Live
      </p>
      <h2 className="gv-home-panel__title">GatorNation Live</h2>
      <p className="gv-home-panel__subtitle">Latest clips, live ticker, and trending topics from the beat.</p>

      {hot.length > 0 && (
        <div className="gv-home-gnl-preview__trending">
          <h3 className="gv-home-recruit-panel__label">Trending now</h3>
          <div className="gv-home-gnl-preview__chips">
            {hot.map((item) => (
              <a key={item.id} href={item.url} className="gv-home-gnl-preview__chip">
                {item.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <ul className="gv-home-gnl-preview__list">
        {items.map((item) => (
          <li key={item.id} className="gv-home-gnl-preview__item">
            {item.url ? (
              <a href={item.url} className="gv-home-gnl-preview__link">
                {item.text}
              </a>
            ) : (
              <span>{item.text}</span>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="gv-home-gnl-preview__empty">Live feed updating — check back shortly.</li>
        )}
      </ul>
      <a href={SITE_ROUTES.gatorNationLive} className="gv-home-card__link">
        Open GatorNation Live →
      </a>
    </article>
  );
}
