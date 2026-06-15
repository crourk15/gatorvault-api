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
        <p className="gnl-hero-eyebrow">Latest Episode</p>
        <h1>{episode.title}</h1>
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
  podcasts: PodcastCardProps[]
): GNLHeroEpisode {
  const latest = feed[0];
  const featured = podcasts[0];
  const title = latest?.headline ?? featured?.title ?? 'GatorNation Live';
  const timestamp = latest?.timestamp ?? new Date().toISOString();
  const date = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return {
    title,
    date: `Posted ${date}`,
    thumbnailUrl:
      featured?.logoUrl || featured?.thumbnailUrl || '/images/podcasts/gators-breakdown.png',
    slug: featured?.id ?? 'latest',
    playUrl: latest?.url ?? featured?.websiteUrl ?? '/gatornation-live#podcast-hub',
    liveUrl: '/gatornation-live',
  };
}
