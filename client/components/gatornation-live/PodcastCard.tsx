'use client';

import React from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';

export function PodcastCard({
  title,
  description,
  thumbnailUrl,
  appleUrl,
  spotifyUrl,
  youtubeUrl,
  websiteUrl,
}: PodcastCardProps): React.ReactElement {
  const links = [
    { label: 'Apple', href: appleUrl },
    { label: 'Spotify', href: spotifyUrl },
    { label: 'YouTube', href: youtubeUrl },
    { label: 'Website', href: websiteUrl },
  ];

  return (
    <article className="gv-gnl-podcast-card" data-testid="gnl-podcast-card">
      <div
        className="gv-gnl-podcast-card__thumb"
        style={
          thumbnailUrl
            ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover' }
            : undefined
        }
        aria-hidden="true"
      >
        {!thumbnailUrl && '🎙️'}
      </div>
      <h3 className="gv-gnl-podcast-card__title">{title}</h3>
      <p className="gv-gnl-podcast-card__desc">{description}</p>
      <div className="gv-gnl-podcast-card__links">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href || '#'}
            className="gv-gnl-podcast-card__btn"
            target={link.href?.startsWith('http') ? '_blank' : undefined}
            rel={link.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}
