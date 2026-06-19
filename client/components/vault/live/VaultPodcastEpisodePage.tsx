'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { findPodcastCatalogEntry, PODCAST_CATALOG, resolvePodcastStreams } from '@/lib/podcast-catalog';

type Props = {
  episodeId: string;
};

export function VaultPodcastEpisodePage({ episodeId }: Props): React.ReactElement {
  const entry =
    findPodcastCatalogEntry(episodeId) ??
    PODCAST_CATALOG.find((p) => p.id === 'gators-breakdown') ??
    PODCAST_CATALOG[0];
  const streams = resolvePodcastStreams(entry.id);
  const listenTargets = [
    streams.appleUrl ? 'Apple Podcasts' : null,
    streams.spotifyUrl ? 'Spotify' : null,
    streams.youtubeUrl ? 'YouTube' : null,
  ].filter(Boolean);
  const listenCopy =
    listenTargets.length > 0
      ? `Stream the latest ${entry.name} episode on ${listenTargets.join(', ')}.`
      : `Stream the latest ${entry.name} episode from the show site.`;

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
          <p className="gv-podcast-episode__show">{entry.name} · GatorNation Live</p>
          <p className="gv-podcast-episode__desc">{listenCopy}</p>
          <div className="gv-podcast-episode__actions">
            {streams.appleUrl ? (
              <Button href={streams.appleUrl} variant="primary">
                Listen on Apple Podcasts
              </Button>
            ) : null}
            {streams.spotifyUrl ? (
              <Button href={streams.spotifyUrl} variant="secondary">
                Spotify
              </Button>
            ) : null}
            {streams.youtubeUrl ? (
              <Button href={streams.youtubeUrl} variant="secondary">
                YouTube
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
