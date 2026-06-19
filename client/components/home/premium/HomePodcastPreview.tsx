'use client';

import React from 'react';
import { PODCAST_CATALOG } from '@/lib/podcast-catalog';

/** UF Premium home — Podcast Spotlight from static catalog (no API). */
export function HomePodcastPreview(): React.ReactElement {
  const shows = PODCAST_CATALOG.slice(0, 4);

  return (
    <section
      className="uf-premium-podcasts"
      aria-label="Podcast spotlight"
      data-testid="home-podcast-preview"
    >
      <div className="uf-premium-podcasts__grid">
        {shows.map((pod) => (
          <article key={pod.id} className="uf-premium-podcast-card">
            <div className="uf-premium-podcast-card__logo-wrap">
              <img
                src={pod.logoUrl}
                alt=""
                className="uf-premium-podcast-card__logo"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== pod.logoFallback) img.src = pod.logoFallback;
                }}
              />
            </div>
            <h3 className="uf-premium-podcast-card__title">{pod.name}</h3>
            <p className="uf-premium-podcast-card__hosts">
              {pod.hosts.length ? pod.hosts.join(' · ') : 'GatorNation network'}
            </p>
            <a href={`/vault/podcast/${pod.id}`} className="uf-premium-podcast-card__cta">
              Listen →
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
