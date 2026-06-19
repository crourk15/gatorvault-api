'use client';

import React, { useMemo } from 'react';
import type { LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { RecruitingFeed } from '@/components/gatornation-live/RecruitingFeed';

type Props = {
  bundle: LiveHubBundle;
  loading?: boolean;
};

/** Live feed module — beat writers + threaded posts, premium card chrome. */
export function GNLLiveFeedModule({ bundle, loading }: Props): React.ReactElement {
  const activeFeed = useMemo(
    () => bundle.feed.filter((item) => item.headline?.trim().length > 0),
    [bundle.feed]
  );

  const beatItems = useMemo(() => {
    const highlights = bundle.panels.beatWriterHighlights.filter((item) => item.text?.trim());
    if (highlights.length > 0) return highlights;
    return bundle.panels.portalBuzz.filter((item) => item.text?.trim());
  }, [bundle.panels.beatWriterHighlights, bundle.panels.portalBuzz]);

  return (
    <section className="gv-gnl-live-module" aria-label="Live feed" data-testid="gnl-live-feed-module">
      <div className="gv-gnl__frame">
        <article className="gv-gnl-card gv-gnl-live-module__card">
          <p className="gv-gnl-live-module__pulse" aria-live="polite">
            <span className="gv-gnl-hero__live-dot" aria-hidden="true" />
            ● LIVE
          </p>

          <BeatWriterCardGrid
            title={GNL_COPY.panels.beat.title}
            description={GNL_COPY.panels.beat.description}
            items={beatItems}
          />

          <div className="gv-gnl-thread gv-gnl-live-module__thread">
            <h2 className="gv-gnl-thread__title">Live Thread</h2>
            {loading && activeFeed.length === 0 ? (
              <p className="gv-gnl-status gv-gnl-thread__empty">Loading live updates…</p>
            ) : (
              <RecruitingFeed items={activeFeed} />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
