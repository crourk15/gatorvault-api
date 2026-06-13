'use client';

import React from 'react';
import type { LiveFeedItem } from '@/lib/live-api';
import { feedIcon, timeAgo } from './live-feed-utils';

export function LiveFeedCard({ item }: { item: LiveFeedItem }): React.ReactElement {
  return (
    <li className="gv-live-feed__row gv-live-feed__row--headline">
      <span className="gv-live-feed__row-icon" aria-hidden="true">
        {feedIcon(item)}
      </span>
      <div className="gv-live-feed__row-body">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="gv-live-feed__row-title">
            {item.title}
          </a>
        ) : (
          <p className="gv-live-feed__row-title">{item.title}</p>
        )}
        <p className="gv-live-feed__row-meta">
          <span className="gv-live-feed__row-source">{item.source || item.type || 'Update'}</span>
          <span className="gv-live-feed__row-time">{timeAgo(item.createdAt)}</span>
        </p>
      </div>
    </li>
  );
}
