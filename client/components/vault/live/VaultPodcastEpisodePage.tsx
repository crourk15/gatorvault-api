'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { findPodcastCatalogEntry, PODCAST_CATALOG } from '@/lib/podcast-catalog';

type Props = {
  episodeId: string;
};

const PODCAST_STREAM_URLS: Record<string, { apple?: string; spotify?: string; web?: string }> = {
  'gators-breakdown': {
    apple: 'https://podcasts.apple.com/us/podcast/gators-breakdown/id1169061256',
    spotify: 'https://open.spotify.com/show/1nLRyUN4rWzgTy0Tu0HjGQ',
    web: 'https://gatorsbreakdown.com',
  },
};

export function VaultPodcastEpisodePage({ episodeId }: Props): React.ReactElement {
  const entry =
    findPodcastCatalogEntry(episodeId) ??
    PODCAST_CATALOG.find((p) => p.id === 'gators-breakdown') ??
    PODCAST_CATALOG[0];
  const streams = PODCAST_STREAM_URLS[entry.id] ?? PODCAST_STREAM_URLS['gators-breakdown'];

  return (
    <div className="gv-page gv-podcast-episode" data-testid="vault-podcast-episode">
      <div className="gv-page-hero gv-podcast-episode__hero">
        <span className="gv-podcast-episode__badge">Now Playing</span>
        <h1 className="gv-page-title">{entry.name}</h1>
        <p className="gv-page-subtitle">
          {entry.hosts?.length ? `Hosted by ${entry.hosts.join(', ')}` : 'Florida Gators podcast coverage'}
        </p>
      </div>

      <div className="gv-podcast-episode__player gv-ds-card">
        <img
          src={entry.logoUrl}
          alt=""
          className="gv-podcast-episode__art"
          onError={(e) => {
            (e.target as HTMLImageElement).src = entry.logoFallback;
          }}
        />
        <div className="gv-podcast-episode__meta">
          <p className="gv-podcast-episode__show">Gators Breakdown · GatorNation Live</p>
          <p className="gv-podcast-episode__desc">
            Stream the latest Gators Breakdown episode on Apple Podcasts, Spotify, or the show site.
          </p>
          <div className="gv-podcast-episode__actions">
            {streams?.apple ? (
              <Button href={streams.apple} variant="primary">
                Listen on Apple Podcasts
              </Button>
            ) : null}
            {streams?.spotify ? (
              <Button href={streams.spotify} variant="secondary">
                Spotify
              </Button>
            ) : null}
            <Button href="/vault/live#podcast-hub" variant="secondary">
              ← Podcast Hub
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
