'use client';

import React, { useState } from 'react';

export type MediaCardProps = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  imageFallback?: string;
  href?: string;
  className?: string;
  testId?: string;
  children?: React.ReactNode;
};

export function MediaCard({
  title,
  subtitle,
  imageUrl,
  imageFallback,
  href,
  className = '',
  testId,
  children,
}: MediaCardProps): React.ReactElement {
  const fallback = imageFallback ?? '/images/podcasts/default.svg';
  const [src, setSrc] = useState(imageUrl);

  const body = (
    <>
      <img
        src={src}
        alt={`${title} logo`}
        className="media-card-image"
        loading="lazy"
        onError={() => {
          if (src !== fallback) setSrc(fallback);
        }}
      />
      <div className="media-card-body">
        <h3 className="media-card-title">{title}</h3>
        {subtitle ? <p className="media-card-subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`media-card${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        {body}
      </a>
    );
  }

  return (
    <div className={`media-card${className ? ` ${className}` : ''}`} data-testid={testId}>
      {body}
    </div>
  );
}
