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
      {!loading && !error ? children : null}
    </>
  );
}

export function PodcastFeed({ podcasts }: { podcasts: PodcastShow[] }): React.ReactElement {
  return (
    <div className="live-feed-list" data-testid="live-podcast-feed">
      {podcasts.map((show, i) => (
        <article key={i} className="live-pod-card">
          <span className="live-pod-card__icon" aria-hidden="true">
            🎙️
          </span>
          <div>
            <p className="live-pod-card__title">{show.title}</p>
            {show.description ? <p className="live-pod-card__desc">{show.description}</p> : null}
            <div className="live-pod-platforms">
              {show.platforms?.map((pl) => (
                <a
                  key={pl.url}
                  href={pl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="live-pod-platform-pill"
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
