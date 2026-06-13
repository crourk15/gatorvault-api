'use client';

import React from 'react';
import { UiEmpty } from '@/components/site/UiMessage';
import type { BeatPost } from '@/lib/live-api';
import { timeAgo } from './live-feed-utils';

export function BeatWriterFeed({ beat }: { beat: BeatPost[] }): React.ReactElement {
  return (
    <ul className="gv-live-feed__list" data-testid="beat-writer-feed">
      {beat.map((p, i) => (
        <li key={i} className="gv-live-feed__row gv-live-feed__row--beat">
          <span className="gv-live-feed__row-icon" aria-hidden="true">
            ✍️
          </span>
          <div className="gv-live-feed__row-body">
            <p className="gv-live-feed__beat-handle">@{String(p.handle ?? '').replace(/^@/, '')}</p>
            <p className="gv-live-feed__beat-text">{p.text}</p>
            <p className="gv-live-feed__row-meta">
              <span className="gv-live-feed__row-source">
                {p.outlet ? `${p.writerName} · ${p.outlet}` : p.writerName || 'Beat'}
              </span>
              <span className="gv-live-feed__row-time">{timeAgo(p.publishedAt)}</span>
            </p>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="gv-live-feed__beat-link">
                View on X →
              </a>
            ) : null}
          </div>
        </li>
      ))}
      {beat.length === 0 && <UiEmpty message="Beat stream loading or awaiting posts." />}
    </ul>
  );
}
