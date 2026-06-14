'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSocialLanes,
  fetchLiveDashboard,
  type BeatPost,
  type LiveFeedItem,
  type PodcastShow,
} from '@/lib/live-api';
import {
  liveFeedTabPath,
  parseLiveFeedTabFromPath,
  type LiveFeedTab,
} from '@/lib/vault-route-map';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { BeatWriterFeed } from './BeatWriterFeed';
import { LiveFeedHeader } from './LiveFeedHeader';
import { LiveFeedShell, PodcastFeed } from './LiveFeedShell';
import { LiveFeedStream } from './LiveFeedStream';
import { PodcastsRecruitingSection } from './PodcastsRecruitingSection';
import { LIVE_REFRESH_MS, LIVE_STATE_KEY, type FeedCategory } from './live-feed-utils';

function liveTabToInternal(tab: LiveFeedTab): 'feed' | 'beat' | 'podcast' {
  if (tab === 'beat') return 'beat';
  if (tab === 'podcasts') return 'podcast';
  return 'feed';
}

/** GatorNation Live — original ESPN row layout (crawler: gv-live-ticker, gv-live-feed__tabs, gv-live-feed__row). */
export function GatorNationLivePage(): React.ReactElement {
  const [tab, setTab] = useState<'feed' | 'beat' | 'podcast'>(() =>
    liveTabToInternal(parseLiveFeedTabFromPath() ?? 'headlines')
  );
  const [category, setCategory] = useState<FeedCategory>('all');
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [beat, setBeat] = useState<BeatPost[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useVaultPageRestore(LIVE_STATE_KEY, (saved) => {
    if (saved.tab === 'beat' || saved.tab === 'podcast' || saved.tab === 'feed') {
      setTab(saved.tab);
    }
    if (saved.filters?.category) {
      setCategory(saved.filters.category as FeedCategory);
    }
  });

  const persistState = useCallback(() => {
    saveVaultPageState(LIVE_STATE_KEY, {
      tab,
      scrollY: window.scrollY,
      filters: { category },
    });
  }, [tab, category]);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const dash = await fetchLiveDashboard(60);
      setFeed(dash.feed);
      setBeat(dash.beat.posts ?? []);
      setPodcasts(dash.podcasts.shows ?? []);
      setUpdatedAt(dash.updatedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live feed.');
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
    const sync = () => setTab(liveTabToInternal(parseLiveFeedTabFromPath() ?? 'headlines'));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const selectTab = (next: LiveFeedTab) => {
    const internal = liveTabToInternal(next);
    setTab(internal);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', liveFeedTabPath(next));
      saveVaultPageState(LIVE_STATE_KEY, { tab: internal, scrollY: window.scrollY, filters: { category } });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await load(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), LIVE_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const onLeave = () => persistState();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') persistState();
    };
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [persistState]);

  const socialLanes = useMemo(() => buildSocialLanes(beat), [beat]);

  return (
    <div className="gv-live-feed gv-live-feed--espn" data-testid="vault-live-feed">
      <LiveFeedHeader feed={feed} tab={tab} updatedAt={updatedAt} onSelectTab={selectTab} />

      <PodcastsRecruitingSection limit={6} className="gv-vault-media-section--live" />

      <div className="gv-live-feed__social-lanes">
        {socialLanes.map((lane) => (
          <section key={lane.id} className="gv-live-feed__social-lane">
            <h2 className="gv-live-feed__social-lane-title">
              <span aria-hidden="true">{lane.icon}</span> {lane.label}
            </h2>
            <ul className="gv-live-feed__list">
              {lane.posts.slice(0, 4).map((p, i) => (
                <li key={`${lane.id}-${i}`} className="gv-live-feed__row gv-live-feed__row--social">
                  <span className="gv-live-feed__row-icon" aria-hidden="true">
                    {lane.icon}
                  </span>
                  <div className="gv-live-feed__row-body">
                    {p.handle && (
                      <p className="gv-live-feed__beat-handle">@{p.handle.replace(/^@/, '')}</p>
                    )}
                    <p className="gv-live-feed__beat-text">{p.text?.slice(0, 160)}</p>
                  </div>
                </li>
              ))}
              {lane.posts.length === 0 && (
                <li className="gv-live-feed__row gv-live-feed__row--empty">No posts in this lane yet.</li>
              )}
            </ul>
          </section>
        ))}
      </div>

      <LiveFeedShell loading={loading} error={error} onRetry={() => void load(true)}>
        {tab === 'feed' && (
          <LiveFeedStream feed={feed} category={category} onCategoryChange={setCategory} />
        )}
        {tab === 'beat' && <BeatWriterFeed beat={beat} />}
        {tab === 'podcast' && <PodcastFeed podcasts={podcasts} />}
      </LiveFeedShell>
    </div>
  );
}
