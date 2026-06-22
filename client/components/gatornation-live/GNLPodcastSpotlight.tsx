'use client';

import React, { useEffect, useState } from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { DEFAULT_PODCASTS } from '@/lib/gatornation-live-api';
import { fetchLivePodcasts } from '@/lib/recruiting-ui-api';
import { resolvePodcastLogo, resolvePodcastLogoFallback } from '@/lib/podcast-catalog';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

function formatTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type Props = {
  podcasts?: PodcastCardProps[];
  updatedAt?: string | null;
};

export function GNLPodcastSpotlight({ podcasts: propPodcasts, updatedAt: propUpdatedAt }: Props): React.ReactElement {
  const [podcasts, setPodcasts] = useState<PodcastCardProps[]>(propPodcasts ?? []);
  const [updatedAt, setUpdatedAt] = useState<string | null | undefined>(propUpdatedAt);

  useEffect(() => {
    let cancelled = false;
    void fetchLivePodcasts()
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setPodcasts(items);
          setUpdatedAt(new Date().toISOString());
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (propPodcasts?.length) setPodcasts(propPodcasts);
    if (propUpdatedAt) setUpdatedAt(propUpdatedAt);
  }, [propPodcasts, propUpdatedAt]);

  const source = podcasts.length > 0 ? podcasts : DEFAULT_PODCASTS;
  const cards = source.slice(0, 4);

  return (
    <section className="gv-gnl-elite-card gv-gnl-elite-podcasts" data-testid="gnl-podcast-spotlight">
      <GNLModuleHead
        title="Podcast Spotlight"
        subtitle="Latest episodes from the GatorNation network"
        badge={<GNLDashBadge label="PODCAST" tone="podcast" />}
        count={`${cards.length} shows`}
      />
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
              <h3 className="gv-gnl-elite-podcast-card__title">
                <span className="gv-gnl-elite-podcast-card__title-text">{pod.title}</span>
              </h3>
              <p className="gv-gnl-elite-podcast-card__episode">
                {pod.episodeTitle ? `Episode: "${pod.episodeTitle}"` : 'Latest episode'}
              </p>
              <p className="gv-gnl-elite-podcast-card__time">{formatTime(pod.publishedAt ?? updatedAt)}</p>
              <a href={href} className="gv-gnl-elite-podcast-card__cta">
                Listen now →
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
