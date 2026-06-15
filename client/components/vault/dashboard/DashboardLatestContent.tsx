'use client';

import React, { useEffect, useState } from 'react';
import type { ContentLatestItem, ContentLatestResponse } from '@/lib/vault-dashboard-api';
import { timeAgo } from './dashboard-utils';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { MediaCard } from '@/components/media/MediaCard';
import { resolvePodcastLogo, resolvePodcastLogoFallback } from '@/lib/podcast-catalog';

type TabId = 'articles' | 'podcasts' | 'filmRoom' | 'community';

const TABS: { id: TabId; label: string }[] = [
  { id: 'articles', label: 'Articles' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'filmRoom', label: 'Film Room' },
  { id: 'community', label: 'Community' },
];

function tabItems(data: ContentLatestResponse | null, tab: TabId): ContentLatestItem[] {
  if (!data) return [];
  return data[tab] ?? [];
}

export function DashboardLatestContent({
  data,
  loading,
}: {
  data: ContentLatestResponse | null;
  loading?: boolean;
}): React.ReactElement {
  const [tab, setTab] = useState<TabId>('articles');
  const items = tabItems(data, tab);

  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      setTab((current) => {
        const idx = TABS.findIndex((t) => t.id === current);
        return TABS[(idx + 1) % TABS.length].id;
      });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [data]);

  if (loading || !data) {
    return (
      <section className="gv-dash-content gv-dash__section" aria-label="Latest content">
        <div className="gv-dash__frame">
          <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.latestContent}</h2>
          <div className="gv-dash-skeleton gv-dash-skeleton--line" style={{ width: '40%' }} />
          <div className="gv-dash-skeleton gv-dash-skeleton--card" />
        </div>
      </section>
    );
  }

  return (
    <section className="gv-dash-content gv-dash__section" aria-label="Latest content" data-testid="dashboard-content">
      <div className="gv-dash__frame">
        <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.latestContent}</h2>

        <div className="gv-dash-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`gv-dash-tabs__btn${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ul className="gv-dash-content__list" role="tabpanel">
          {items.length === 0 && (
            <li className="gv-dash-content__row">
              <span className="gv-dash-content__meta">{GV_COPY.empty.noContent}</span>
            </li>
          )}
          {items.map((item) =>
            tab === 'podcasts' ? (
              <li key={item.id} className="gv-dash-content__row gv-dash-content__row--media">
                <MediaCard
                  title={item.title}
                  subtitle={
                    [item.source, item.timestamp ? timeAgo(item.timestamp) : null]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  imageUrl={
                    item.icon?.startsWith('/') ? item.icon : resolvePodcastLogo(item.title)
                  }
                  imageFallback={resolvePodcastLogoFallback(item.title)}
                  href={item.href}
                  className="media-card--podcast"
                />
              </li>
            ) : (
              <li key={item.id} className="gv-dash-content__row">
                <span className="gv-dash-content__thumb" aria-hidden="true">
                  {item.icon || '📌'}
                </span>
                <div className="gv-dash-content__body">
                  <a href={item.href} className="gv-dash-content__title">
                    {item.title}
                  </a>
                  <div className="gv-dash-content__meta">
                    {item.source}
                    {item.timestamp ? ` · ${timeAgo(item.timestamp)}` : ''}
                    {item.replyCount != null && item.replyCount > 0
                      ? ` · ${item.replyCount} replies`
                      : ''}
                  </div>
                </div>
                <span className="gv-dash-content__chev" aria-hidden="true">
                  ›
                </span>
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
}
