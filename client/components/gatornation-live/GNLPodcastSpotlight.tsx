'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { DEFAULT_PODCASTS } from '@/lib/gatornation-live-api';
import { fetchLivePodcasts } from '@/lib/recruiting-ui-api';
import {
  PODCAST_CATALOG,
  resolvePodcastLogo,
  resolvePodcastLogoFallback,
} from '@/lib/podcast-catalog';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function catalogAsCards(): PodcastCardProps[] {
  return PODCAST_CATALOG.map((entry, idx) => {
    const fallback = DEFAULT_PODCASTS[idx];
    return {
      id: entry.id,
      title: entry.name,
      description: fallback?.description || `${entry.name} — Florida Gators coverage.`,
      logoUrl: entry.logoUrl,
      thumbnailUrl: entry.logoFallback,
      hosts: entry.hosts,
      appleUrl: entry.appleUrl || fallback?.appleUrl || '#',
      spotifyUrl: entry.spotifyUrl || fallback?.spotifyUrl || '#',
      youtubeUrl: entry.youtubeUrl || fallback?.youtubeUrl || '#',
      websiteUrl: entry.siteUrl || fallback?.websiteUrl || '#',
      episodeTitle: undefined,
      publishedAt: undefined,
    };
  });
}

/** Merge live episode data onto the full network catalog so every show stays visible. */
function mergeNetworkPodcasts(live: PodcastCardProps[]): PodcastCardProps[] {
  const catalog = catalogAsCards();
  const byId = new Map<string, PodcastCardProps>();
  const byTitle = new Map<string, PodcastCardProps>();

  for (const pod of live) {
    if (pod.id) byId.set(pod.id, pod);
    if (pod.title) byTitle.set(pod.title.toLowerCase(), pod);
  }

  return catalog.map((show) => {
    const hit = (show.id && byId.get(show.id)) || byTitle.get(show.title.toLowerCase());
    if (!hit) return show;
    return {
      ...show,
      ...hit,
      id: hit.id || show.id,
      title: hit.title || show.title,
      logoUrl: hit.logoUrl || show.logoUrl,
      episodeTitle: hit.episodeTitle?.trim() || undefined,
      publishedAt: hit.publishedAt || undefined,
    };
  });
}

type Props = {
  podcasts?: PodcastCardProps[];
  updatedAt?: string | null;
};

/** Full GatorNation podcast network — latest episodes when available, all shows always listed. */
export function GNLPodcastSpotlight({
  podcasts: propPodcasts,
  updatedAt: propUpdatedAt,
}: Props): React.ReactElement {
  const [livePods, setLivePods] = useState<PodcastCardProps[]>(propPodcasts ?? []);
  const [updatedAt, setUpdatedAt] = useState<string | null | undefined>(propUpdatedAt);

  useEffect(() => {
    let cancelled = false;
    void fetchLivePodcasts()
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setLivePods(items);
          setUpdatedAt(new Date().toISOString());
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (propPodcasts?.length) setLivePods(propPodcasts);
    if (propUpdatedAt) setUpdatedAt(propUpdatedAt);
  }, [propPodcasts, propUpdatedAt]);

  const cards = useMemo(() => mergeNetworkPodcasts(livePods), [livePods]);
  const withEpisodes = cards.filter((p) => p.episodeTitle?.trim()).length;

  return (
    <section className="gv-gnl-elite-card gv-gnl-elite-podcasts" data-testid="gnl-podcast-spotlight">
      <GNLModuleHead
        title="GatorNation Podcasts"
        subtitle={
          withEpisodes > 0
            ? 'Latest episodes plus the full network'
            : 'Listen anytime across the GatorNation network'
        }
        badge={<GNLDashBadge label="PODCAST" tone="podcast" />}
        count={`${cards.length} shows`}
      />
      <div className="gv-gnl-elite-podcasts__grid">
        {cards.map((pod, idx) => {
          const key = pod.id ?? pod.title ?? String(idx);
          const logo = pod.logoUrl ?? resolvePodcastLogo(key) ?? resolvePodcastLogoFallback(key);
          const href = pod.id ? `/vault/podcast/${pod.id}` : '/vault/podcast/gators-breakdown';
          const when = formatTime(pod.publishedAt ?? (pod.episodeTitle ? updatedAt : null));
          const hasEpisode = Boolean(pod.episodeTitle?.trim());
          return (
            <article
              key={key}
              className={`gv-gnl-elite-podcast-card${hasEpisode ? ' gv-gnl-elite-podcast-card--fresh' : ''}`}
            >
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
              {hasEpisode ? (
                <p className="gv-gnl-elite-podcast-card__episode">
                  Episode: &quot;{pod.episodeTitle}&quot;
                </p>
              ) : (
                <p className="gv-gnl-elite-podcast-card__episode">
                  {pod.hosts?.length ? pod.hosts.join(' · ') : 'Full show archive'}
                </p>
              )}
              {when ? <p className="gv-gnl-elite-podcast-card__time">{when}</p> : null}
              <a href={href} className="gv-gnl-elite-podcast-card__cta">
                {hasEpisode ? 'Listen now →' : 'Open show →'}
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
