'use client';

import React from 'react';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import type { PodcastShow } from '@/lib/live-api';

export function LiveFeedShell({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {loading && <p className="gv-page-status">Loading live feed…</p>}
      {error && !loading && (
        <UiError message={error} retry={onRetry} backHref="/vault" backLabel="← Dashboard" />
      )}
      {!error ? children : null}
    </>
  );
}

export function PodcastFeed({ podcasts }: { podcasts: PodcastShow[] }): React.ReactElement {
  return (
    <div className="gv-live-feed__list live-feed-list" data-testid="live-podcast-feed">
      {podcasts.map((show, i) => (
        <article key={i} className="gv-live-feed__podcast-card gv-live-media-card">
          <span className="gv-live-feed__podcast-icon gv-live-podcast-thumb" aria-hidden="true">
            🎙️
          </span>
          <div className="gv-live-feed__podcast-body">
            <p className="gv-live-feed__podcast-title">{show.title}</p>
            {show.description ? <p className="gv-live-feed__podcast-desc">{show.description}</p> : null}
            <div className="gv-live-feed__podcast-platforms">
              {show.platforms?.map((pl) => (
                <a
                  key={pl.url}
                  href={pl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gv-live-feed__podcast-pill"
                >
                  {pl.name}
                </a>
              ))}
            </div>
          </div>
        </article>
      ))}
      {podcasts.length === 0 && <UiEmpty message="No podcast shows listed yet." />}
    </div>
  );
}
