'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';

export type GNLHeroEpisode = {
  title: string;
  date: string;
  thumbnailUrl: string;
  slug: string;
  playUrl: string;
  liveUrl: string;
  showName?: string;
  hosts?: string;
};

type Props = {
  episode: GNLHeroEpisode;
};

export function GNLHero({ episode }: Props): React.ReactElement {
  return (
    <section className="gnl-hero" data-testid="gnl-hero" aria-label="Latest episode">
      <div className="gnl-hero__thumb-wrap">
        <div className="gnl-hero-thumb">
          <img src={episode.thumbnailUrl} alt="" />
          <span className="gnl-hero-thumb__overlay" aria-hidden="true" />
          <span className="gnl-hero-thumb__play" aria-hidden="true">
            ▶
          </span>
        </div>
      </div>
      <div className="gnl-hero-content">
        <p className="gnl-hero-eyebrow">
          <span className="gnl-hero-eyebrow__badge">Now Playing</span>
          Latest Episode
        </p>
        <h1>{episode.title}</h1>
        {episode.showName && episode.showName !== episode.title ? (
          <p className="gnl-hero-show">{episode.showName}</p>
        ) : null}
        {episode.hosts ? <p className="gnl-hero-hosts">{episode.hosts}</p> : null}
        <p className="gnl-hero-date">{episode.date}</p>
        <div className="gnl-hero-actions">
          <Button href={episode.liveUrl} variant="primary">
            Watch Live
          </Button>
          <Button href={episode.playUrl} variant="secondary">
            View Episode
          </Button>
        </div>
      </div>
    </section>
  );
}

export function buildGNLHeroEpisode(
  feed: RecruitingUpdateCardProps[],
  podcasts: PodcastCardProps[],
  liveBase = '/vault/live'
): GNLHeroEpisode {
  const featured = podcasts[0];
  const latestNews = feed.find((item) => item.category !== 'Commit') ?? feed[0];
  const title = featured?.title ?? latestNews?.headline ?? 'GatorNation Live';
  const timestamp = latestNews?.timestamp ?? new Date().toISOString();
  const date = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const playUrl = featured?.id
    ? `/vault/podcast/${featured.id}`
    : `${liveBase}#podcast-hub`;

  return {
    title,
    date: `Posted ${date}`,
    thumbnailUrl:
      featured?.logoUrl || featured?.thumbnailUrl || '/images/podcasts/gators-breakdown.png',
    slug: featured?.id ?? 'latest',
    playUrl,
    liveUrl: liveBase,
    showName: featured?.title,
    hosts: featured?.hosts?.join(', '),
  };
}
