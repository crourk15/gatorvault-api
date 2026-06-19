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
      <div className="uf-premium-gnl-preview" data-testid="home-gnl-preview">
        <div className="uf-premium-skeleton" style={{ minHeight: 160 }} />
      </div>
    );
  }

  return (
    <div className="uf-premium-gnl-preview" data-testid="home-gnl-preview">
      <article className="uf-premium-gnl-preview__card" aria-label="GatorNation Live preview">
        <p className="uf-premium-gnl-preview__pulse">
          <span className="uf-premium-gnl-preview__pulse-dot" aria-hidden="true" />
          ● LIVE
        </p>
        <ul className="uf-premium-gnl-preview__list">
          {items.map((item) => (
            <li key={item.id} className="uf-premium-gnl-preview__item">
              {item.href ? (
                <a href={item.href} className="uf-premium-gnl-preview__text">
                  <span className="uf-premium-gnl-preview__author">{item.author}</span>
                  {item.text}
                </a>
              ) : (
                <>
                  <span className="uf-premium-gnl-preview__author">{item.author}</span>
                  <span className="uf-premium-gnl-preview__text">{item.text}</span>
                </>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="uf-premium-gnl-preview__empty">Live feed updating — check back shortly.</li>
          )}
        </ul>
        <a href={SITE_ROUTES.gatorNationLive} className="uf-premium-gnl-preview__cta">
          Open GatorNation Live →
        </a>
      </article>
    </div>
  );
}
