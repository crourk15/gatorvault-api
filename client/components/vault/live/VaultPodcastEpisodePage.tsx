'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { findPodcastCatalogEntry, PODCAST_CATALOG } from '@/lib/podcast-catalog';

type Props = {
  episodeId: string;
};

export function VaultPodcastEpisodePage({ episodeId }: Props): React.ReactElement {
  const entry =
    findPodcastCatalogEntry(episodeId) ??
    PODCAST_CATALOG.find((p) => p.id === 'gators-breakdown') ??
    PODCAST_CATALOG[0];

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
          <p className="gv-podcast-episode__show">Latest episode · GatorNation Live</p>
          <p className="gv-podcast-episode__desc">
            Stream the latest show on your preferred platform or return to the live hub for more coverage.
          </p>
          <div className="gv-podcast-episode__actions">
            <Button href="/vault/live#podcast-hub" variant="secondary">
              ← Podcast Hub
            </Button>
            <Button href="/vault/live" variant="primary">
              GatorNation Live
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
