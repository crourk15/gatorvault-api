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

export function GNLBreakingNewsPanel({ item }: Props): React.ReactElement | null {
  if (!item?.text?.trim()) return null;

  return (
    <article className="gv-gnl-elite-card gv-gnl-elite-breaking" data-testid="gnl-breaking-news">
      <GNLModuleHead title="Breaking News" badge={<GNLDashBadge label="BREAKING" tone="breaking" pulse />} />
      <p className="gv-gnl-elite-breaking__text">{item.text}</p>
      <p className="gv-gnl-elite-breaking__meta">
        {formatTime(item.timestamp)} · {item.source}
      </p>
      <a href={item.url} className="gv-gnl-elite-breaking__link">
        Full details →
      </a>
    </article>
  );
}
