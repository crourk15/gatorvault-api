'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  useVaultPageRestore(LIVE_STATE_KEY, () => {});

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setError(null);
    }
    try {
      // Initial: cache-first. Polls: force refresh for beat freshness.
      const next = await fetchLiveHubBundle(!isInitial);
      setBundle((prev) => {
        const nextLive =
          (next.feed?.length || 0) + (next.panels?.beatWriterHighlights?.length || 0);
        const prevLive =
          (prev.feed?.length || 0) + (prev.panels?.beatWriterHighlights?.length || 0);
        // Don't blank the page when a poll fails / API returns empty mid-outage.
        if (nextLive === 0 && prevLive > 0) return prev;
        return next;
      });
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
      (bundle.panels.beatWriterHighlights?.length ?? 0) > 0,
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
