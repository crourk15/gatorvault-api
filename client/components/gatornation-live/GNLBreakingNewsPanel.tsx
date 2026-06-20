'use client';

import React from 'react';
import type { BreakingNewsItem } from '@/lib/gatornation-live-types';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Just now';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type Props = {
  item: BreakingNewsItem | null;
};

export function GNLBreakingNewsPanel({ item }: Props): React.ReactElement {
  const hasNews = Boolean(item?.text?.trim());

  return (
    <article
      className={`gv-gnl-elite-card gv-gnl-elite-breaking${hasNews ? '' : ' gv-gnl-elite-breaking--empty'}`}
      data-testid="gnl-breaking-news"
    >
      <GNLModuleHead
        title="Breaking News"
        badge={
          hasNews ? (
            <GNLDashBadge label="BREAKING" tone="breaking" pulse />
          ) : (
            <GNLDashBadge label="CLEAR" tone="neutral" />
          )
        }
        count={hasNews ? '1 active' : '0 active'}
      />
      {hasNews && item ? (
        <>
          <p className="gv-gnl-elite-breaking__text">{item.text}</p>
          <p className="gv-gnl-elite-breaking__meta">
            {formatTime(item.timestamp)} · {item.source}
          </p>
          <a href={item.url} className="gv-gnl-elite-breaking__link">
            Full details →
          </a>
        </>
      ) : (
        <p className="gv-gnl-elite-breaking__text gv-gnl-elite-breaking__text--empty">
          No breaking news right now.
        </p>
      )}
    </article>
  );
}
