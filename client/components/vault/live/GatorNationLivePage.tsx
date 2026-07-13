'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/uf-premium-gnl.css';
import '@/lib/gnl.css';
import {
  fetchLiveHubBundle,
  LIVE_HUB_REFRESH_MS,
  type LiveHubBundle,
} from '@/lib/gatornation-live-api';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { LIVE_STATE_KEY } from '@/components/vault/live/live-feed-utils';
import { UiError } from '@/components/site/UiMessage';
import { GNLPageHero } from '@/components/gatornation-live/GNLPageHero';
import { GNLLiveFeedModule } from '@/components/gatornation-live/GNLLiveFeedModule';

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
  breakingNews: null,
  gameDay: null,
  updatedAt: null,
  refreshedAt: null,
};

/** GatorNation Live — stream-first, honest empty states (45s refresh). */
export function GatorNationLivePage(): React.ReactElement {
  const [bundle, setBundle] = useState<LiveHubBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollSeq, setPollSeq] = useState(0);

  useVaultPageRestore(LIVE_STATE_KEY, () => {});

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchLiveHubBundle(!isInitial);
      setBundle(next);
      if (!isInitial) setPollSeq((n) => n + 1);
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

  const hasLiveSignal = useMemo(
    () =>
      (bundle.feed?.length ?? 0) > 0 ||
      (bundle.ticker?.length ?? 0) > 0 ||
      (bundle.panels.beatWriterHighlights?.length ?? 0) > 0 ||
      (bundle.podcasts ?? []).some((p) => p.episodeTitle?.trim()),
    [bundle]
  );

  return (
    <div
      className="gv-gnl gv-gnl-shell gv-gnl-shell--elite uf-premium-gnl gv-live-feed"
      data-testid="vault-live-feed"
    >
      {error && !loading && (
        <div className="gv-gnl__frame gv-gnl__command">
          <UiError
            message={error}
            retry={() => void load(true)}
            backHref="/vault"
            backLabel="← Home"
          />
        </div>
      )}

      <GNLPageHero updatedAt={bundle.updatedAt ?? bundle.refreshedAt} hasLiveSignal={hasLiveSignal} />
      <GNLLiveFeedModule bundle={bundle} loading={loading} refreshKey={bundle.refreshedAt ?? `${pollSeq}`} />
    </div>
  );
}
