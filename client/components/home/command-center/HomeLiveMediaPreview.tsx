'use client';

import React from 'react';
import type { HomeGnlItem } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  items: HomeGnlItem[];
};

export function HomeLiveMediaPreview({ items }: Props): React.ReactElement {
  return (
    <section className="gv-hcc-section gv-hcc-widget gv-hcc-widget--gnl" data-testid="home-gnl-preview">
      <header className="gv-hcc-widget__head">
        <h2 className="gv-hcc-widget__title">
          <span aria-hidden>📡</span> GatorNation Live
        </h2>
      </header>
      <p className="gv-hcc-widget__meta">Beat writers, commits, and live recruiting pulse</p>
      <ul className="gv-hcc-gnl-list">
        {items.slice(0, 3).map((item) => (
          <li key={item.id}>
            <span className="gv-hcc-gnl-list__author">{item.author}</span>
            <span className="gv-hcc-gnl-list__text">{item.text}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li>
            <span className="gv-hcc-gnl-list__text">Live feed updating — check back shortly.</span>
          </li>
        )}
      </ul>
      <a href={SITE_ROUTES.gatorNationLive} className="gv-hcc-widget__cta">
        Open Live Hub →
      </a>
    </section>
  );
}
