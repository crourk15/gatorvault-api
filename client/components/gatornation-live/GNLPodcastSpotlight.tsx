'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { fetchLivePodcasts } from '@/lib/recruiting-ui-api';
import { resolvePodcastLogo, resolvePodcastLogoFallback } from '@/lib/podcast-catalog';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type Props = {
  podcasts?: PodcastCardProps[];
  updatedAt?: string | null;
};

/** Podcast spotlight — real latest episodes only (no show stubs). */
export function GNLPodcastSpotlight({
  podcasts: propPodcasts,
  updatedAt: propUpdatedAt,
}: Props): React.ReactElement | null {
  const [podcasts, setPodcasts] = useState<PodcastCardProps[]>(propPodcasts ?? []);
  const [updatedAt, setUpdatedAt] = useState<string | null | undefined>(propUpdatedAt);

  useEffect(() => {
    let cancelled = false;
    void fetchLivePodcasts()
      .then((items) => {
        const withEpisodes = items.filter((p) => p.episodeTitle?.trim());
        if (!cancelled && withEpisodes.length > 0) {
          setPodcasts(withEpisodes);
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

  const cards = useMemo(
    () => podcasts.filter((p) => p.episodeTitle?.trim()).slice(0, 2),
    [podcasts]
  );

  if (!cards.length) return null;

  return (
    <section className="gv-gnl-elite-card gv-gnl-elite-podcasts" data-testid="gnl-podcast-spotlight">
      <GNLModuleHead
        title="Latest episodes"
        subtitle="From the GatorNation network"
        badge={<GNLDashBadge label="PODCAST" tone="podcast" />}
        count={`${cards.length} episode${cards.length === 1 ? '' : 's'}`}
      />
      <div className="gv-gnl-elite-podcasts__grid gv-gnl-elite-podcasts__grid--lean">
        {cards.map((pod, idx) => {
          const key = pod.id ?? pod.title ?? String(idx);
          const logo = pod.logoUrl ?? resolvePodcastLogo(key) ?? resolvePodcastLogoFallback(key);
          const href = pod.id ? `/vault/podcast/${pod.id}` : '/vault/podcast/gators-breakdown';
          const when = formatTime(pod.publishedAt ?? updatedAt);
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
              <p className="gv-gnl-elite-podcast-card__episode">Episode: &quot;{pod.episodeTitle}&quot;</p>
              {when ? <p className="gv-gnl-elite-podcast-card__time">{when}</p> : null}
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
