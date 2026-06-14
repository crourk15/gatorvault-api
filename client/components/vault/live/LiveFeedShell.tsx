'use client';

import React from 'react';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import type { PodcastShow } from '@/lib/live-api';
import { PodcastCard } from './PodcastsRecruitingSection';

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
  if (!podcasts.length) {
    return <UiEmpty message="No podcast shows listed yet." />;
  }

  return (
    <div className="gv-vault-media-section__grid" data-testid="live-podcast-feed">
      {podcasts.map((show, i) => (
        <PodcastCard key={`${show.title}-${i}`} show={show} />
      ))}
    </div>
  );
}
