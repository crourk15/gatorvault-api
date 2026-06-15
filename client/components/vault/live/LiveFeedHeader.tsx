'use client';

import React from 'react';
import type { LiveFeedItem } from '@/lib/live-api';
import { type LiveFeedTab } from '@/lib/vault-route-map';
import { timeAgo } from './live-feed-utils';

function LiveTicker({ items }: { items: LiveFeedItem[] }): React.ReactElement {
  const headlines = items.slice(0, 12);
  const tickerText =
    headlines
      .map((h) => h.title?.trim())
      .filter(Boolean)
      .join(' · ') || 'GatorNation Live — commits, portal, and beat writers updating in real time';
  const loop = [tickerText, tickerText];
  return (
    <div className="gv-live-ticker" aria-label="Breaking headlines ticker">
      <span className="gv-live-ticker__badge">LIVE</span>
      <div className="gv-live-ticker__track">
        <div className="gv-live-ticker__scroll">
          {loop.map((text, idx) => (
            <span key={idx} className="gv-live-ticker__text" aria-hidden={idx === 1 ? true : undefined}>
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiveFeedHeader({
  feed,
  tab,
  updatedAt,
  onSelectTab,
}: {
  feed: LiveFeedItem[];
  tab: 'feed' | 'beat' | 'podcast';
  updatedAt: string | null;
  onSelectTab: (tab: LiveFeedTab) => void;
}): React.ReactElement {
  return (
    <>
      <LiveTicker items={feed} />
      <div className="gv-live-feed__hero">
        <div>
          <h1 className="gv-page-title">GatorNation Live</h1>
          <p className="gv-page-subtitle">
            Real-time media center — headlines, beat writers, and podcasts. Auto-refreshes every 60s.
          </p>
        </div>
        <span className="gv-live-feed__refresh-badge">
          ↻ 60s{updatedAt ? ` · ${timeAgo(updatedAt)}` : ''}
        </span>
      </div>
      <div className="gv-live-feed__tabs">
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'feed' ? ' is-active' : ''}`}
          onClick={() => onSelectTab('headlines')}
        >
          📰 Headlines
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'beat' ? ' is-active' : ''}`}
          onClick={() => onSelectTab('beat')}
        >
          ✍️ Beat Writers
        </button>
        <button
          type="button"
          className={`gv-live-feed__tab${tab === 'podcast' ? ' is-active' : ''}`}
          onClick={() => onSelectTab('podcasts')}
        >
          🎙️ Podcasts
        </button>
      </div>
    </>
  );
}
