'use client';

import React from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { MediaCard } from '@/components/media/MediaCard';
import {
  resolvePodcastHosts,
  resolvePodcastLogo,
  resolvePodcastLogoFallback,
} from '@/lib/podcast-catalog';

export function PodcastCard({
  id,
  title,
  description,
  logoUrl,
  thumbnailUrl,
  hosts,
  appleUrl,
  spotifyUrl,
  youtubeUrl,
  websiteUrl,
}: PodcastCardProps): React.ReactElement {
  const catalogKey = id ?? title;
  const imageUrl = logoUrl ?? thumbnailUrl ?? resolvePodcastLogo(catalogKey);
  const imageFallback = resolvePodcastLogoFallback(catalogKey);
  const hostLine = (hosts?.length ? hosts : resolvePodcastHosts(catalogKey)).join(', ');
  const subtitle = hostLine || description;

  const links = [
    { label: 'Apple', href: appleUrl },
    { label: 'Spotify', href: spotifyUrl },
    { label: 'YouTube', href: youtubeUrl },
    { label: 'Website', href: websiteUrl },
  ].filter((link) => link.href && link.href !== '#');

  return (
    <MediaCard
      title={title}
      subtitle={subtitle}
      imageUrl={imageUrl}
      imageFallback={imageFallback}
      href={id ? `/vault/podcast/${id}` : `/vault/podcast/gators-breakdown`}
      className="media-card--podcast"
      testId="gnl-podcast-card"
    >
      <div className="media-card-links">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="media-card-link"
            target={link.href.startsWith('http') ? '_blank' : undefined}
            rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {link.label}
          </a>
        ))}
      </div>
    </MediaCard>
  );
}
