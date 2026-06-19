'use client';

import React from 'react';
import type { HomeGnlItem } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  items: HomeGnlItem[];
  loading?: boolean;
};

/** UF Premium home — GatorNation Live preview wired to live ticker. */
export function HomeGnlPreview({ items, loading }: Props): React.ReactElement {
  if (loading && items.length === 0) {
    return (
      <div className="uf-premium-grid uf-premium-grid--2" data-testid="home-gnl-preview">
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  return (
    <div className="uf-premium-grid uf-premium-grid--2" data-testid="home-gnl-preview">
      <article className="uf-premium-card uf-premium-card--gnl-preview" aria-label="GatorNation Live preview">
        <div className="uf-premium-card__graphic" aria-hidden="true">
          <span className="uf-premium-card__graphic-ring" />
          <span className="uf-premium-card__graphic-dot" />
        </div>
        <p className="uf-premium-card__pulse">
          <span className="uf-premium-card__pulse-dot" aria-hidden="true" />
          ● LIVE
        </p>
        <h3 className="uf-premium-card__title">Beat Feed</h3>
        <ul className="uf-premium-card__list">
          {items.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <a href={item.href}>
                  <span className="uf-premium-card__body" style={{ display: 'block', marginBottom: 4 }}>
                    {item.author}
                  </span>
                  {item.text}
                </a>
              ) : (
                <>
                  <span className="uf-premium-card__body" style={{ display: 'block', marginBottom: 4 }}>
                    {item.author}
                  </span>
                  <span className="uf-premium-card__body">{item.text}</span>
                </>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li>
              <span className="uf-premium-empty">Live feed updating — check back shortly.</span>
            </li>
          )}
        </ul>
        <a
          href={SITE_ROUTES.gatorNationLive}
          className="uf-premium-cta uf-premium-cta--primary uf-premium-cta--block"
        >
          Open GatorNation Live
        </a>
      </article>
    </div>
  );
}
