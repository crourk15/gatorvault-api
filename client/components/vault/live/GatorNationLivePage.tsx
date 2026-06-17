'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/gatornation-live.css';
import { fetchLiveHubBundle, LIVE_HUB_REFRESH_MS, type LiveHubBundle } from '@/lib/gatornation-live-api';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { LIVE_STATE_KEY } from '@/components/vault/live/live-feed-utils';
import { UiError } from '@/components/site/UiMessage';
import { Button } from '@/components/ui';
import { GNLPageHero } from '@/components/gatornation-live/GNLPageHero';
import { GNLHero, buildGNLHeroEpisode } from '@/components/gatornation-live/GNLHero';
import { LiveTicker } from '@/components/gatornation-live/LiveTicker';
import { BeatWriterCardGrid } from '@/components/gatornation-live/BeatWriterCardGrid';
import { PodcastGrid } from '@/components/gatornation-live/PodcastGrid';
import { RecruitingFeed } from '@/components/gatornation-live/RecruitingFeed';
import { RecruitingSnapshot } from '@/components/gatornation-live/RecruitingSnapshot';
import { MovementIntelPreview } from '@/components/gatornation-live/MovementIntelPreview';
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

/** GatorNation Live — premium real-time media hub (Dashboard blueprint layout). */
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
      <section className="gv-gnl-hero-section" aria-label="Hero section">
        <GNLPageHero />
        <LiveTicker items={bundle.ticker} loading={loading && !bundle.ticker.length} />
      </section>

      <div className="gv-gnl__frame gv-gnl__command">
        {error && !loading && (
          <UiError
            message={error}
            retry={() => void load(true)}
            backHref="/vault"
            backLabel="← Dashboard"
          />
        )}

        <div className="gv-gnl__grid">
          <div className="gv-gnl__cell gv-gnl__cell--12">
            <GNLHero episode={heroEpisode} />
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--8">
            <article className="gv-gnl-card" aria-label="Latest headlines">
              <h2 className="gv-gnl-card__title">{GNL_COPY.recruitingFeed}</h2>
              {loading && bundle.feed.length === 0 ? (
                <p className="gv-gnl-status">Loading feed…</p>
              ) : (
                <RecruitingFeed items={bundle.feed} />
              )}
            </article>
          </div>

          <div className="gv-gnl__cell gv-gnl__cell--4 gv-gnl__cell--stack">
            <RecruitingSnapshot {...bundle.snapshot} />
            <MovementIntelPreview data={bundle.movement} loading={loading && !bundle.movement} />
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
            <article className="gv-gnl-card" aria-label="Podcast hub" id="podcast-hub">
              <h2 className="gv-gnl-card__title">{GNL_COPY.podcastHub}</h2>
              <PodcastGrid podcasts={bundle.podcasts} />
            </article>
          </div>
        </div>
      </div>

      <LiveFooter />
    </div>
  );
}
