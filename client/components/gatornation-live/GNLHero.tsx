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

/** Featured episode card — lives in the 12-col grid, not the page hero band. */
export function GNLHero({ episode }: Props): React.ReactElement {
  return (
    <article className="gv-gnl-card gv-gnl-episode-card" data-testid="gnl-hero" aria-label="Latest clips">
      <p className="gv-gnl-card__eyebrow">
        <span className="gv-gnl-hero__live-dot" aria-hidden="true" />
        Latest Clips
      </p>
      <div className="gv-gnl-episode">
        <a
          href={episode.playUrl}
          className="gv-gnl-episode__thumb-wrap"
          aria-label={`View episode: ${episode.title}`}
        >
          <div className="gv-gnl-episode-thumb">
            <img src={episode.thumbnailUrl} alt="" />
            <span className="gv-gnl-episode-thumb__overlay" aria-hidden="true" />
            <span className="gv-gnl-episode-thumb__play" aria-hidden="true">▶</span>
          </div>
        </a>
        <div className="gv-gnl-episode__content">
          <h2 className="gv-gnl-episode__title">{episode.title}</h2>
          <p className="gv-gnl-episode__show">{episode.showName}</p>
          {episode.hosts ? <p className="gv-gnl-episode__hosts">Hosts: {episode.hosts}</p> : null}
          {episode.description ? <p className="gv-gnl-episode__desc">{episode.description}</p> : null}
          <p className="gv-gnl-episode__date">{episode.date}</p>
          <div className="gv-gnl-episode__actions">
            <Button href={episode.playUrl} variant="primary">
              View Episode →
            </Button>
            <Button href="#podcast-hub" variant="secondary">
              All Podcasts
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function buildGNLHeroEpisode(
  feed: RecruitingUpdateCardProps[],
  podcasts: PodcastCardProps[]
): GNLHeroEpisode {
  const featured = podcasts[0];
  const catalog = findPodcastCatalogEntry('gators-breakdown');
  const latestNews = feed.find((item) => item.category !== 'Commit') ?? feed[0];
  const timestamp = latestNews?.timestamp ?? new Date().toISOString();
  const date = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const slug = 'gators-breakdown';
  const playUrl = `/vault/podcast/${slug}`;
  const showName = catalog?.name ?? 'Gators Breakdown';
  const title = featured?.title && featured.title !== showName ? featured.title : showName;

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
