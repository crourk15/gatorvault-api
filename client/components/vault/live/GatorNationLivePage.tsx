'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/gatornation-live.css';
import { fetchLiveHubBundle, LIVE_HUB_REFRESH_MS, type LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { LIVE_STATE_KEY } from '@/components/vault/live/live-feed-utils';
import { UiError } from '@/components/site/UiMessage';
import { Button } from '@/components/ui';
import { GNLLivePulse } from '@/components/gatornation-live/GNLLivePulse';
import { GNLHero, buildGNLHeroEpisode } from '@/components/gatornation-live/GNLHero';
import { LiveTicker } from '@/components/gatornation-live/LiveTicker';
import { GNLTrendingTopics } from '@/components/gatornation-live/GNLTrendingTopics';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { PodcastGrid } from '@/components/gatornation-live/PodcastGrid';
import { GNLFilmRoomPreview } from '@/components/gatornation-live/GNLFilmRoomPreview';
import { RecruitingFeed } from '@/components/gatornation-live/RecruitingFeed';
import { LiveFooter } from '@/components/gatornation-live/LiveFooter';

const EMPTY_BUNDLE: LiveHubBundle = {
  ticker: [],
  feed: [],
  podcasts: [],
  panels: { visitsNow: [], portalBuzz: [], beatWriterHighlights: [], staffNotes: [] },
  snapshot: {
    commits: 0,
    nationalRank: null,
    secRank: null,
    blueChips: 0,
    inStatePercent: 0,
    momentum: 0,
    momentumTrend: 'neutral',
  },
  movement: null,
  updatedAt: null,
};

/** GatorNation Live — media-first live hub (no Team Hub / recruiting snapshot content). */
export function GatorNationLivePage(): React.ReactElement {
  const [bundle, setBundle] = useState<LiveHubBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useVaultPageRestore(LIVE_STATE_KEY, () => {});

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      setBundle(await fetchLiveHubBundle(!isInitial));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load GatorNation Live.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    document.body.classList.add('gv-live-page-active');
    return () => document.body.classList.remove('gv-live-page-active');
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, LIVE_HUB_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const persist = () => saveVaultPageState(LIVE_STATE_KEY, { scrollY: window.scrollY });
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, []);

  const heroEpisode = useMemo(
    () => buildGNLHeroEpisode(bundle.feed, bundle.podcasts),
    [bundle.feed, bundle.podcasts]
  );

  return (
    <div className="gv-gnl gv-gnl-shell gv-live-feed" data-testid="vault-live-feed">
      <div className="gv-gnl__frame gv-gnl__command">
        {error && !loading && (
          <UiError
            message={error}
            retry={() => void load(true)}
            backHref="/vault"
            backLabel="← Home"
          />
        )}

        <div className="gv-gnl__grid">
          <div className="gv-gnl__cell gv-gnl__cell--12">
            <GNLLivePulse />
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--12">
            <LiveTicker items={bundle.ticker} loading={loading && !bundle.ticker.length} />
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--12">
            <GNLHero episode={heroEpisode} />
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--12">
            <GNLTrendingTopics feed={bundle.feed} ticker={bundle.ticker} />
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--12">
            <article className="gv-gnl-card gv-gnl-beat-wrap">
              <BeatWriterCardGrid
                title={GNL_COPY.panels.beat.title}
                description={GNL_COPY.panels.beat.description}
                items={bundle.panels.beatWriterHighlights}
              />
              <div className="gv-gnl__tri-col-cta">
                <Button href="/vault/live#beat-writers" variant="secondary">
                  View All Beat Writers
                </Button>
              </div>
            </article>
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--12">
            <article className="gv-gnl-card" aria-label="Media grid">
              <h2 className="gv-gnl-card__title">{GNL_COPY.mediaGrid}</h2>
              {loading && bundle.feed.length === 0 ? (
                <p className="gv-gnl-status">Loading media…</p>
              ) : (
                <RecruitingFeed items={bundle.feed} />
              )}
            </article>
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--6">
            <article className="gv-gnl-card" aria-label="Podcast hub" id="podcast-hub">
              <h2 className="gv-gnl-card__title">{GNL_COPY.podcastHub}</h2>
              <PodcastGrid podcasts={bundle.podcasts} />
            </article>
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--6">
            <GNLFilmRoomPreview />
          </div>
        </div>
      </div>

      <LiveFooter />
    </div>
  );
}
