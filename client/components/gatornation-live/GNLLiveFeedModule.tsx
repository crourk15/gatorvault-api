'use client';

import React, { useMemo } from 'react';
import type { LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { GNLEliteTicker } from '@/components/gatornation-live/GNLEliteTicker';
import { GNLBreakingNewsPanel } from '@/components/gatornation-live/GNLBreakingNewsPanel';
import { GNLPodcastSpotlight } from '@/components/gatornation-live/GNLPodcastSpotlight';
import { GNLGameDayCountdown } from '@/components/gatornation-live/GNLGameDayCountdown';

type Props = {
  bundle: LiveHubBundle;
  loading?: boolean;
};

/** Elite UF Premium GNL body — ticker, breaking, beat writers, podcasts, game day. */
export function GNLLiveFeedModule({ bundle, loading }: Props): React.ReactElement {
  const beatItems = useMemo(() => {
    const highlights = bundle.panels.beatWriterHighlights.filter((item) => item.text?.trim());
    if (highlights.length > 0) return highlights;
    return bundle.panels.portalBuzz.filter((item) => item.text?.trim());
  }, [bundle.panels.beatWriterHighlights, bundle.panels.portalBuzz]);

  return (
    <div className="gv-gnl-elite" aria-label="GatorNation Live modules" data-testid="gnl-live-feed-module">
      <div className="gv-gnl__frame gv-gnl-elite__stack">
        {loading && bundle.ticker.length === 0 ? (
          <div className="gv-gnl-elite-skeleton" aria-hidden="true" />
        ) : (
          <GNLEliteTicker items={bundle.ticker} refreshKey={bundle.updatedAt} />
        )}

        <GNLBreakingNewsPanel item={bundle.breakingNews} />
        <GNLGameDayCountdown game={bundle.gameDay} />

        <section className="gv-gnl-elite-card gv-gnl-elite-beat">
          <BeatWriterCardGrid
            title={GNL_COPY.panels.beat.title}
            description={GNL_COPY.panels.beat.description}
            items={beatItems}
          />
        </section>

        <GNLPodcastSpotlight podcasts={bundle.podcasts} updatedAt={bundle.updatedAt} />
      </div>
    </div>
  );
}
