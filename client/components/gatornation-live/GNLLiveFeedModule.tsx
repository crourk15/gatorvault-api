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
  refreshKey?: string | null;
};

/** Elite UF Premium GNL body — ticker, beat writers, podcasts, breaking, game day. */
export function GNLLiveFeedModule({ bundle, loading: _loading, refreshKey }: Props): React.ReactElement {
  const beatItems = useMemo(
    () => bundle.panels.beatWriterHighlights.filter((item) => item.text?.trim()),
    [bundle.panels.beatWriterHighlights]
  );

  return (
    <div className="gv-gnl-elite" aria-label="GatorNation Live modules" data-testid="gnl-live-feed-module">
      <div className="gv-gnl__frame gv-gnl-elite__stack">
        <GNLEliteTicker
          items={bundle.ticker}
          refreshKey={refreshKey ?? bundle.refreshedAt ?? bundle.updatedAt}
        />

        <section className="gv-gnl-elite-card gv-gnl-elite-beat">
          <BeatWriterCardGrid
            title={GNL_COPY.panels.beat.title}
            description={GNL_COPY.panels.beat.description}
            items={beatItems}
          />
        </section>

        <GNLPodcastSpotlight podcasts={bundle.podcasts} updatedAt={bundle.updatedAt} />

        <div className="gv-gnl-elite-bottom">
          <GNLBreakingNewsPanel item={bundle.breakingNews} />
          <GNLGameDayCountdown game={bundle.gameDay} />
        </div>
      </div>
    </div>
  );
}
