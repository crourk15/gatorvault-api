'use client';

import React from 'react';
import type { HomeGnlItem } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  items: HomeGnlItem[];
};

export function HomeGatorNationPreview({ items }: Props): React.ReactElement {
  return (
    <article
      className="gv-home__cell gv-home__cell--6"
      aria-label="GatorNation Live preview"
      data-testid="home-gnl-preview"
    >
      <div className="gv-home-card">
        <div className="gv-home-card__accent" />
        <h2 className="gv-home-card__title">GatorNation Live</h2>
        <p className="gv-home-body">
          Latest clips, live ticker, and trending topics from the beat.
        </p>
        <ul className="gv-home-list gv-home-list--gnl">
          {items.map((item) => (
            <li key={item.id}>
              <span className="gv-home-list__primary">{item.author}</span>
              <span className="gv-home-list__meta">{item.text}</span>
            </li>
          ))}
          {items.length === 0 && (
            <li>
              <span className="gv-home-list__meta">Live feed updating — check back shortly.</span>
            </li>
          )}
        </ul>
        <a href={SITE_ROUTES.gatorNationLive} className="gv-home-link">
          Open GatorNation Live →
        </a>
      </div>
    </article>
  );
}
