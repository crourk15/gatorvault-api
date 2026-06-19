'use client';

import React from 'react';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import { sourceBadge } from '@/lib/gatornation-live-api';
import { Chip } from '@/components/ui/Chip';
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
  icon,
}: RecruitingUpdateCardProps): React.ReactElement {
  const timeLabel = formatTimeAgo(timestamp);

  return (
    <a
      href={url}
      className="gv-card gv-card--light gv-card--interactive gv-gnl-feed-card gv-live-feed__row gv-live-feed__row--headline rh-cc-feed__item"
      data-testid="gnl-feed-card"
    >
      <span className="rh-cc-feed__icon gv-gnl-feed-card__badge" aria-hidden>
        {icon || sourceBadge(source)}
      </span>
      <div className="gv-gnl-feed-card__body rh-cc-feed__body">
        <p className="gv-gnl-feed-card__headline rh-cc-feed__text">{headline}</p>
        <p className="gv-gnl-feed-card__meta">
          <Chip variant="timestamp" className="gv-gnl-feed-card__time-chip">
            {timeLabel}
          </Chip>
          <span className="gv-gnl-feed-card__cat">{category}</span>
          {' · '}
          {source}
        </p>
      </div>
    </a>
  );
}
