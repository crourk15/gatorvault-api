'use client';

import React, { useMemo, useState } from 'react';
import type { LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { SITE_ROUTES } from '@/lib/site-routes';
import { filterExcludedPortalClassItems } from '@/lib/portal-class-filter';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { GNLEliteTicker } from '@/components/gatornation-live/GNLEliteTicker';
import { GNLPodcastSpotlight } from '@/components/gatornation-live/GNLPodcastSpotlight';
import { GNLPulseSummary } from '@/components/gatornation-live/GNLPulseSummary';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';
import { LiveFeedStream } from '@/components/vault/live/LiveFeedStream';
import type { FeedCategory } from '@/components/vault/live/live-feed-utils';

type Props = {
  bundle: LiveHubBundle;
  loading?: boolean;
  refreshKey?: string | null;
};

function GnlQuietEmpty(): React.ReactElement {
  return (
    <section className="gv-gnl-elite-card gv-gnl-empty" data-testid="gnl-quiet-empty" aria-live="polite">
      <h2 className="gv-gnl-empty__title">{GNL_COPY.emptyState.title}</h2>
      <p className="gv-gnl-empty__body">{GNL_COPY.emptyState.body}</p>
      <div className="gv-gnl-empty__doors">
        <a href={SITE_ROUTES.recruiting} className="gv-gnl-empty__door">
          {GNL_COPY.emptyState.recruitingLabel}
        </a>
        <a href={SITE_ROUTES.team} className="gv-gnl-empty__door">
          {GNL_COPY.emptyState.teamLabel}
        </a>
      </div>
    </section>
  );
}

/** Fan-first Live body — stream first; hide empty pulse/beat/podcasts. */
export function GNLLiveFeedModule({ bundle, loading: _loading, refreshKey }: Props): React.ReactElement {
  const [category, setCategory] = useState<FeedCategory>('all');

  const beatItems = useMemo(
    () =>
      filterExcludedPortalClassItems(
        bundle.panels.beatWriterHighlights.filter((item) => item.text?.trim()),
        (item) => item.text,
        (item) => ({ source: item.source })
      ),
    [bundle.panels.beatWriterHighlights]
  );

  const feed = bundle.feed ?? [];
  const hasStream = feed.length > 0;
  const hasTicker = (bundle.ticker ?? []).length > 0;
  const hasBeat = beatItems.length > 0;
  const hasPodcasts = (bundle.podcasts ?? []).some((p) => p.episodeTitle?.trim());
  const isQuiet = !hasStream && !hasTicker && !hasBeat && !hasPodcasts;

  return (
    <div className="gv-gnl-elite" aria-label="GatorNation Live modules" data-testid="gnl-live-feed-module">
      <GNLEliteTicker
        items={bundle.ticker}
        refreshKey={refreshKey ?? bundle.refreshedAt ?? bundle.updatedAt}
      />

      <div className="gv-gnl__frame gv-gnl-elite__stack">
        {hasStream ? (
          <section className="gv-gnl-elite-card gv-gnl-elite-stream" data-testid="gnl-live-stream">
            <GNLModuleHead
              title={GNL_COPY.stream.title}
              subtitle={GNL_COPY.stream.subtitle}
              badge={<GNLDashBadge label="LIVE" tone="team" />}
              count={`${feed.length} item${feed.length === 1 ? '' : 's'}`}
            />
            <LiveFeedStream feed={feed} category={category} onCategoryChange={setCategory} />
          </section>
        ) : null}

        <GNLPulseSummary bundle={bundle} />

        {hasBeat ? (
          <section className="gv-gnl-elite-card gv-gnl-elite-beat">
            <BeatWriterCardGrid
              title={GNL_COPY.panels.beat.title}
              description={GNL_COPY.panels.beat.description}
              items={beatItems}
            />
          </section>
        ) : null}

        <GNLPodcastSpotlight podcasts={bundle.podcasts} updatedAt={bundle.updatedAt} />

        {isQuiet ? <GnlQuietEmpty /> : null}
      </div>
    </div>
  );
}
