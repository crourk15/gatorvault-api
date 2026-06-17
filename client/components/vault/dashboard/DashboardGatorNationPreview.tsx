'use client';

import React from 'react';
import type { TickerResponse } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  ticker: TickerResponse | null;
};

export function DashboardGatorNationPreview({ ticker }: Props): React.ReactElement {
  const items = (ticker?.items ?? []).slice(0, 5);
  const hot = ticker?.hotToday?.slice(0, 3) ?? [];

  return (
    <article
      className="gv-dash-panel gv-dash-card gv-dash-gnl-preview"
      aria-label="GatorNation Live preview"
      data-testid="dashboard-gnl-preview"
    >
      <div className="gv-dash-gnl-preview__hero" aria-hidden="true" />
      <p className="gv-dash-card__eyebrow">
        <span className="gv-dash-hero__live-dot" aria-hidden="true" />
        GatorNation Live
      </p>
      <h2 className="gv-dash-panel__title">ESPN-style live pulse</h2>
      <p className="gv-dash-panel__subtitle">Latest clips, live ticker, and trending topics from the beat.</p>

      {hot.length > 0 && (
        <div className="gv-dash-gnl-preview__trending">
          <h3 className="gv-dash-recruit-panel__label">Trending now</h3>
          <div className="gv-dash-gnl-preview__chips">
            {hot.map((item) => (
              <a key={item.id} href={item.url} className="gv-dash-gnl-preview__chip">
                {item.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <ul className="gv-dash-gnl-preview__list">
        {items.map((item) => (
          <li key={item.id} className="gv-dash-gnl-preview__item">
            {item.url ? (
              <a href={item.url} className="gv-dash-gnl-preview__link">
                {item.text}
              </a>
            ) : (
              <span>{item.text}</span>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="gv-dash-gnl-preview__empty">Live feed updating — check back shortly.</li>
        )}
      </ul>
      <a href={SITE_ROUTES.gatorNationLive} className="gv-dash-card__link">
        Open GatorNation Live →
      </a>
    </article>
  );
}
