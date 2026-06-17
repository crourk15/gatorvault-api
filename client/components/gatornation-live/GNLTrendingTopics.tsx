'use client';

import React, { useMemo } from 'react';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import type { LiveTickerItem } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';

type Props = {
  feed: RecruitingUpdateCardProps[];
  ticker: LiveTickerItem[];
};

export function GNLTrendingTopics({ feed, ticker }: Props): React.ReactElement {
  const topics = useMemo(() => {
    const seen = new Set<string>();
    const rows: { label: string; href: string }[] = [];

    for (const item of ticker.slice(0, 8)) {
      const label = item.text.split('·')[0]?.trim().slice(0, 48) || item.text.slice(0, 48);
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      rows.push({ label, href: item.url || '/gator-nation-live' });
      if (rows.length >= 6) break;
    }

    if (rows.length < 4) {
      for (const item of feed) {
        const label = item.category || item.headline.slice(0, 40);
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        rows.push({ label, href: item.url });
        if (rows.length >= 6) break;
      }
    }

    return rows;
  }, [feed, ticker]);

  return (
    <article className="gv-gnl-card" aria-label="Trending topics" data-testid="gnl-trending-topics">
      <h2 className="gv-gnl-card__title">{GNL_COPY.trendingTopics}</h2>
      {topics.length === 0 ? (
        <p className="gv-gnl-status">Trending topics will appear as the feed updates.</p>
      ) : (
        <div className="gv-gnl-trending__chips">
          {topics.map((topic) => (
            <a key={topic.label} href={topic.href} className="gv-gnl-trending__chip">
              {topic.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
