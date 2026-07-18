'use client';

import React, { useMemo, useState } from 'react';
import type { LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { SITE_ROUTES } from '@/lib/site-routes';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { usePathname } from '@/lib/use-pathname';
import { vaultAwareHref } from '@/lib/vault-aware-href';
import { filterExcludedPortalClassItems } from '@/lib/portal-class-filter';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { GNLEliteTicker } from '@/components/gatornation-live/GNLEliteTicker';
import { GNLPodcastSpotlight } from '@/components/gatornation-live/GNLPodcastSpotlight';
import { GNLPulseSummary } from '@/components/gatornation-live/GNLPulseSummary';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';
import { LiveFeedStream } from '@/components/vault/live/LiveFeedStream';
import type { FeedCategory } from '@/components/vault/live/live-feed-utils';

export type GnlFocusSection = 'podcasts' | 'beat';

type Props = {
  bundle: LiveHubBundle;
  loading?: boolean;
  refreshKey?: string | null;
  /** Deep-link focus — reorder modules instead of scroll-jump. */
  focusSection?: GnlFocusSection;
};

function GnlQuietEmpty(): React.ReactElement {
  const pathname = usePathname();
  const recruitingHref = vaultAwareHref(pathname, SITE_ROUTES.recruiting, VAULT_PILLAR_ROUTES.recruiting);
  const teamHref = vaultAwareHref(pathname, SITE_ROUTES.team, VAULT_PILLAR_ROUTES.team);

  return (
    <section className="gv-gnl-elite-card gv-gnl-empty" data-testid="gnl-quiet-empty" aria-live="polite">
      <h2 className="gv-gnl-empty__title">{GNL_COPY.emptyState.title}</h2>
      <p className="gv-gnl-empty__body">{GNL_COPY.emptyState.body}</p>
      <div className="gv-gnl-empty__doors">
        <a href={recruitingHref} className="gv-gnl-empty__door">
          {GNL_COPY.emptyState.recruitingLabel}
        </a>
        <a href={teamHref} className="gv-gnl-empty__door">
          {GNL_COPY.emptyState.teamLabel}
        </a>
      </div>
    </section>
  );
}

/** Fan-first Live body — beat/stream first; podcasts last unless deep-linked. */
export function GNLLiveFeedModule({
  bundle,
  loading: _loading,
  refreshKey,
  focusSection,
}: Props): React.ReactElement {
  const pathname = usePathname();
  const liveHref = vaultAwareHref(pathname, SITE_ROUTES.gatorNationLive, VAULT_PILLAR_ROUTES.liveFeed);
  const [category, setCategory] = useState<FeedCategory>('all');
  const podcastsFirst = focusSection === 'podcasts';
  const beatFirst = focusSection === 'beat';

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
  // Quiet = no live news signal. Podcasts always render below and do not count as "live".
  const isQuiet = !hasStream && !hasTicker && !hasBeat;

  const streamBlock = hasStream ? (
    <section className="gv-gnl-elite-card gv-gnl-elite-stream" data-testid="gnl-live-stream">
      <GNLModuleHead
        title={GNL_COPY.stream.title}
        subtitle={GNL_COPY.stream.subtitle}
        badge={<GNLDashBadge label="LIVE" tone="team" />}
        count={`${feed.length} item${feed.length === 1 ? '' : 's'}`}
      />
      <LiveFeedStream feed={feed} category={category} onCategoryChange={setCategory} />
    </section>
  ) : null;

  const beatBlock = hasBeat ? (
    <section className="gv-gnl-elite-card gv-gnl-elite-beat" id="beat-writers">
      <BeatWriterCardGrid
        title={GNL_COPY.panels.beat.title}
        description={GNL_COPY.panels.beat.description}
        items={beatItems}
      />
    </section>
  ) : null;

  const podcastBlock = (
    <GNLPodcastSpotlight podcasts={bundle.podcasts} updatedAt={bundle.updatedAt} />
  );

  return (
    <div className="gv-gnl-elite" aria-label="GatorNation Live modules" data-testid="gnl-live-feed-module">
      <GNLEliteTicker
        items={bundle.ticker}
        refreshKey={refreshKey ?? bundle.refreshedAt ?? bundle.updatedAt}
      />

      <div className="gv-gnl__frame gv-gnl-elite__stack">
        {podcastsFirst ? (
          <>
            {podcastBlock}
            <p className="gv-gnl-elite__back">
              <a href={liveHref}>← Full GatorNation Live feed</a>
            </p>
            {streamBlock}
            {beatBlock}
            <GNLPulseSummary bundle={bundle} />
            {isQuiet ? <GnlQuietEmpty /> : null}
          </>
        ) : beatFirst ? (
          <>
            {beatBlock}
            {streamBlock}
            <GNLPulseSummary bundle={bundle} />
            {isQuiet ? <GnlQuietEmpty /> : null}
            {podcastBlock}
          </>
        ) : (
          <>
            {streamBlock}
            {beatBlock}
            <GNLPulseSummary bundle={bundle} />
            {isQuiet ? <GnlQuietEmpty /> : null}
            {podcastBlock}
          </>
        )}
      </div>
    </div>
  );
}
