'use client';

import React from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { resolvePodcastLogo, resolvePodcastLogoFallback } from '@/lib/podcast-catalog';

function formatTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type Props = {
  podcasts: PodcastCardProps[];
  updatedAt?: string | null;
};

export function GNLPodcastSpotlight({ podcasts, updatedAt }: Props): React.ReactElement {
  const cards = podcasts.slice(0, 4);

  return (
    <section className="gv-gnl-elite-card gv-gnl-elite-podcasts" data-testid="gnl-podcast-spotlight">
      <header className="gv-gnl-elite-card__head">
        <h2 className="gv-gnl-elite-card__title">Podcast Spotlight</h2>
        <p className="gv-gnl-elite-card__sub">Latest episodes from the GatorNation network</p>
      </header>
      <div className="gv-gnl-elite-podcasts__grid">
        {cards.map((pod, idx) => {
          const key = pod.id ?? pod.title ?? String(idx);
          const logo = pod.logoUrl ?? resolvePodcastLogo(key) ?? resolvePodcastLogoFallback(key);
          const href = pod.id ? `/vault/podcast/${pod.id}` : '/vault/podcast/gators-breakdown';
          return (
            <article key={key} className="gv-gnl-elite-podcast-card">
              <div className="gv-gnl-elite-podcast-card__logo-wrap uf-podcast-logo-wrap">
                <img
                  src={logo}
                  alt=""
                  className="gv-gnl-elite-podcast-card__logo"
                  width={56}
                  height={56}
                  loading="lazy"
                />
              </div>
              <h3 className="gv-gnl-elite-podcast-card__title">{pod.title}</h3>
              <p className="gv-gnl-elite-podcast-card__episode">
                {pod.episodeTitle ? `Episode: "${pod.episodeTitle}"` : 'Latest episode'}
              </p>
              <p className="gv-gnl-elite-podcast-card__time">{formatTime(pod.publishedAt ?? updatedAt)}</p>
              <a href={href} className="gv-gnl-elite-podcast-card__cta">
                Listen →
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
