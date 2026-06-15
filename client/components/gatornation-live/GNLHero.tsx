'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { findPodcastCatalogEntry } from '@/lib/podcast-catalog';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';

export type GNLHeroEpisode = {
  title: string;
  showName: string;
  date: string;
  thumbnailUrl: string;
  slug: string;
  playUrl: string;
  hosts?: string;
  description?: string;
};

type Props = {
  episode: GNLHeroEpisode;
};

export function GNLHero({ episode }: Props): React.ReactElement {
  return (
    <section className="gnl-hero" data-testid="gnl-hero" aria-label="Latest episode">
      <a href={episode.playUrl} className="gnl-hero__thumb-wrap" aria-label={`View episode: ${episode.title}`}>
        <div className="gnl-hero-thumb">
          <img src={episode.thumbnailUrl} alt="" />
          <span className="gnl-hero-thumb__overlay" aria-hidden="true" />
          <span className="gnl-hero-thumb__play" aria-hidden="true">
            ▶
          </span>
        </div>
      </a>
      <div className="gnl-hero-content">
        <p className="gnl-hero-eyebrow">
          <span className="gnl-hero-eyebrow__badge">Now Playing</span>
          Latest Episode
        </p>
        <h1>{episode.title}</h1>
        <p className="gnl-hero-show">{episode.showName}</p>
        {episode.hosts ? <p className="gnl-hero-hosts">Hosts: {episode.hosts}</p> : null}
        {episode.description ? <p className="gnl-hero-desc">{episode.description}</p> : null}
        <p className="gnl-hero-date">{episode.date}</p>
        <div className="gnl-hero-actions">
          <Button href={episode.playUrl} variant="primary">
            View Episode →
          </Button>
          <Button href="/vault/live#podcast-hub" variant="secondary">
            All Podcasts
          </Button>
        </div>
      </div>
    </section>
  );
}

export function buildGNLHeroEpisode(
  feed: RecruitingUpdateCardProps[],
  podcasts: PodcastCardProps[]
): GNLHeroEpisode {
  const featured = podcasts[0];
  const catalog = findPodcastCatalogEntry(featured?.id ?? featured?.title);
  const latestNews = feed.find((item) => item.category !== 'Commit') ?? feed[0];
  const timestamp = latestNews?.timestamp ?? new Date().toISOString();
  const date = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const slug = featured?.id ?? catalog?.id ?? 'gators-breakdown';
  const playUrl = `/vault/podcast/${slug}/`;
  const showName = catalog?.name ?? featured?.title ?? 'GatorNation Live';
  const title = featured?.title ?? showName;

  return {
    title,
    showName,
    date: `Updated ${date}`,
    thumbnailUrl:
      featured?.logoUrl || featured?.thumbnailUrl || catalog?.logoUrl || '/images/podcasts/gators-breakdown.png',
    slug,
    playUrl,
    hosts: featured?.hosts?.join(', ') ?? catalog?.hosts?.join(', '),
    description: featured?.description ?? `${showName} — Florida Gators coverage on GatorVault.`,
  };
}
