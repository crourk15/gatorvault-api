'use client';

import React from 'react';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import { sourceBadge } from '@/lib/gatornation-live-api';
import { timeAgo } from '@/components/vault/live/live-feed-utils';

function formatTimeAgo(iso: string): string {
  if (!iso) return 'Recently';
  const t = timeAgo(iso);
  if (t === 'Just now') return t;
  return `${t} ago`;
}

export function RecruitingUpdateCard({
  source,
  headline,
  url,
  timestamp,
  category,
}: RecruitingUpdateCardProps): React.ReactElement {
  return (
    <a href={url} className="gv-gnl-feed-card gv-live-feed__row gv-live-feed__row--headline" data-testid="gnl-feed-card">
      <span className="gv-gnl-feed-card__badge" aria-label={source}>
        {sourceBadge(source)}
      </span>
      <div className="gv-gnl-feed-card__body">
        <p className="gv-gnl-feed-card__headline">{headline}</p>
        <p className="gv-gnl-feed-card__meta">
          <span className="gv-live-feed__row-time">{formatTimeAgo(timestamp)}</span>
          {' · Source: '}
          {source}
          <span className="gv-gnl-feed-card__cat">{category}</span>
        </p>
      </div>
    </a>
  );
}
