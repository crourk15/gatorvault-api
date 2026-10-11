'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/lib/uf-premium-gnl.css';
import '@/lib/gnl.css';
import {
  fetchLiveHubBundle,
  LIVE_HUB_REFRESH_MS,
  type LiveHubBundle,
} from '@/lib/gatornation-live-api';
import { buildSeedLiveHubBundle } from '@/lib/gnl-hub-seed';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { LIVE_STATE_KEY } from '@/components/vault/live/live-feed-utils';
import { UiError } from '@/components/site/UiMessage';
import { GNLPageHero } from '@/components/gatornation-live/GNLPageHero';
import {
  GNLLiveFeedModule,
  type GnlFocusSection,
} from '@/components/gatornation-live/GNLLiveFeedModule';

const SEED_BUNDLE: LiveHubBundle = buildSeedLiveHubBundle();
const EMPTY_RETRY_MS = [1200, 2500, 4000];

export type GatorNationLiveFocus = GnlFocusSection;

type GatorNationLivePageProps = {
  /** Deep-link target when opened from Menu / tab paths. */
  focusSection?: GatorNationLiveFocus;
};

/** GatorNation Live — seeded first paint, then live refresh (45s). */
export function GatorNationLivePage({ focusSection }: GatorNationLivePageProps = {}): React.ReactElement {
  const [bundle, setBundle] = useState<LiveHubBundle>(SEED_BUNDLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollSeq, setPollSeq] = useState(0);
  const [liveFresh, setLiveFresh] = useState(false);
  const emptyRetryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useVaultPageRestore(LIVE_STATE_KEY, () => {});

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setError(null);
    }
    try {
      // Initial hits the network (SWR skipped). Polls force a beat refresh.
      const next = await fetchLiveHubBundle(!isInitial);
      const nextLive =
        (next.feed?.length || 0) + (next.panels?.beatWriterHighlights?.length || 0);
      if (nextLive > 0) {
        emptyRetryRef.current = 0;
        setLiveFresh(true);
      } else if (emptyRetryRef.current < EMPTY_RETRY_MS.length) {
        const wait = EMPTY_RETRY_MS[emptyRetryRef.current];
        emptyRetryRef.current += 1;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          void load(false);
        }, wait);
      }
      setBundle((prev) => {
        const prevLive =
          (prev.feed?.length || 0) + (prev.panels?.beatWriterHighlights?.length || 0);
        // Don't blank the page when a poll fails / API returns empty mid-outage.
        if (nextLive === 0 && prevLive > 0) return prev;
        return next;
      });
      if (!isInitial) setPollSeq((n) => n + 1);
    } catch (err) {
      // Forever-seed: keep painted GNL shell; only hard-error when there is no live signal at all.
      const seeded =
        (SEED_BUNDLE.feed?.length || 0) +
          (SEED_BUNDLE.panels?.beatWriterHighlights?.length || 0) >
        0;
      if (!seeded) {
        setError(err instanceof Error ? err.message : 'Could not load GatorNation Live.');
      }
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

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
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
      (bundle.panels.beatWriterHighlights?.length ?? 0) > 0,
    [bundle]
  );

  return (
    <div
      className="gv-gnl gv-gnl-shell gv-gnl-shell--elite uf-premium-gnl gv-live-feed"
      data-testid="vault-live-feed"
    >
      {error && !loading && !hasLiveSignal && (
        <div className="gv-gnl__frame gv-gnl__command">
          <UiError
            message={error}
            retry={() => void load(true)}
            backHref="/vault"
            backLabel="← Home"
          />
        </div>
      )}

      {!liveFresh && hasLiveSignal ? (
        <div className="gv-gnl__frame" style={{ paddingTop: '0.75rem' }}>
          <p className="gv-gnl__meta" style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            Showing latest available feed — live refresh is catching up.
          </p>
        </div>
      ) : null}

      <GNLPageHero
        updatedAt={bundle.updatedAt ?? bundle.refreshedAt}
        hasLiveSignal={hasLiveSignal}
        title={focusSection === 'podcasts' ? 'Podcasts' : undefined}
        subtitle={
          focusSection === 'podcasts'
            ? 'GatorNation shows and recruiting audio — stay in the vault.'
            : undefined
        }
      />
      <GNLLiveFeedModule
        bundle={bundle}
        loading={loading}
        refreshKey={bundle.refreshedAt ?? `${pollSeq}`}
        focusSection={focusSection}
      />
    </div>
  );
}
