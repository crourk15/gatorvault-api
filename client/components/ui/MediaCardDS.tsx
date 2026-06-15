'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HeadingM, BodyM } from './Typography';

type Props = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  imageFallback?: string;
  href?: string;
  className?: string;
  testId?: string;
};

/** Design-system MediaCard — image top, title, subtitle, arrow on hover. */
export function MediaCardDS({
  title,
  subtitle,
  imageUrl,
  imageFallback = '/images/podcasts/default.svg',
  href,
  className = '',
  testId,
}: Props): React.ReactElement {
  const [src, setSrc] = useState(imageUrl);

  const body = (
    <>
      <img
        src={src}
        alt=""
        className="gv-ds-media-card__image"
        loading="lazy"
        onError={() => {
          if (src !== imageFallback) setSrc(imageFallback);
        }}
      />
      <div className="gv-ds-media-card__body">
        <HeadingM>{title}</HeadingM>
        {subtitle ? <BodyM>{subtitle}</BodyM> : null}
        <span className="gv-ds-media-card__arrow">View →</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`gv-ds-card gv-ds-media-card${className ? ` ${className}` : ''}`}
        data-testid={testId}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={`gv-ds-card gv-ds-media-card${className ? ` ${className}` : ''}`} data-testid={testId}>
      {body}
    </div>
  );
}
