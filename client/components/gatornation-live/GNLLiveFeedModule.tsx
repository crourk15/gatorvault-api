'use client';

import React, { useMemo } from 'react';
import type { LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { filterExcludedPortalClassItems } from '@/lib/portal-class-filter';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { GNLEliteTicker } from '@/components/gatornation-live/GNLEliteTicker';
import { GNLPodcastSpotlight } from '@/components/gatornation-live/GNLPodcastSpotlight';
import { GNLPulseSummary } from '@/components/gatornation-live/GNLPulseSummary';

type Props = {
  bundle: LiveHubBundle;
  loading?: boolean;
  refreshKey?: string | null;
};

/** Elite UF Premium GNL body — ticker, pulse, beat writers, podcasts. */
export function GNLLiveFeedModule({ bundle, loading: _loading, refreshKey }: Props): React.ReactElement {
  const beatItems = useMemo(
    () =>
      filterExcludedPortalClassItems(
        bundle.panels.beatWriterHighlights.filter((item) => item.text?.trim()),
        (item) => item.text,
        (item) => ({ source: item.source })
      ),
    [bundle.panels.beatWriterHighlights]
  );

  return (
    <div className="gv-gnl-elite" aria-label="GatorNation Live modules" data-testid="gnl-live-feed-module">
      <GNLEliteTicker
        items={bundle.ticker}
        refreshKey={refreshKey ?? bundle.refreshedAt ?? bundle.updatedAt}
      />

      <div className="gv-gnl__frame gv-gnl-elite__stack">
        <GNLPulseSummary bundle={bundle} />

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
