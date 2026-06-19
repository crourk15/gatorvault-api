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

function categoryClass(category: string): string {
  const key = category.toLowerCase();
  if (key.includes('break')) return 'gv-gnl-thread-card__cat--breaking';
  if (key.includes('visit') || key.includes('ov')) return 'gv-gnl-thread-card__cat--visit';
  if (key.includes('commit')) return 'gv-gnl-thread-card__cat--commit';
  if (key.includes('portal') || key.includes('transfer')) return 'gv-gnl-thread-card__cat--portal';
  if (key.includes('rumor') || key.includes('beat')) return 'gv-gnl-thread-card__cat--rumor';
  return 'gv-gnl-thread-card__cat--default';
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
      className="gv-gnl-thread-card"
      data-testid="gnl-feed-card"
    >
      <span className="gv-gnl-thread-card__badge" aria-hidden>
        {icon || sourceBadge(source)}
      </span>
      <div className="gv-gnl-thread-card__body">
        <p className="gv-gnl-thread-card__headline">{headline}</p>
        <p className="gv-gnl-thread-card__meta">
          {timeLabel}
          {category ? (
            <>
              {' · '}
              <span className={`gv-gnl-thread-card__cat ${categoryClass(category)}`}>{category}</span>
            </>
          ) : null}
          {' · '}
          {source}
        </p>
      </div>
    </a>
  );
}
