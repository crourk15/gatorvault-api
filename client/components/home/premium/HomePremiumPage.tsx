'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/home-wow.css';
import {
  fetchHomeBundle,
  HOME_REFRESH,
  type HomeBundle,
} from '@/lib/vault-home-api';
import { fetchRecruitingBoard, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchLiveHubBundle } from '@/lib/gatornation-live-api';
import type { LivePanelProps } from '@/lib/gatornation-live-types';
import { filterExcludedPortalClassItems } from '@/lib/portal-class-filter';
import { useVaultDataReload } from '@/lib/vault-navigation';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { HomeCommandCenter } from '@/components/home/premium/command/HomeCommandCenter';
import {
  buildBeatPosts,
  buildFutureCastTargets,
  buildGameDayView,
  buildHeroTickerItems,
  buildRecruitingMetricsView,
} from '@/components/home/premium/command/home-command-utils';

const EMPTY_BUNDLE: HomeBundle = {
  ticker: null,
  movement: null,
  content: null,
  recruiting: null,
  momentumPct: 0,
  personalized: null,
  portal: null,
  team: null,
  nil: null,
  schedule: null,
};

/** Vault home — WOW command center (hero → gameday → strip → recruiting → FC → beat). */
export function HomePremiumPage(): React.ReactElement {
  const [bundle, setBundle] = useState<HomeBundle>(EMPTY_BUNDLE);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [beatItems, setBeatItems] = useState<LivePanelProps['items']>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    try {
      const fetchHome = () =>
        fetchWithWarmPoll(() => fetchHomeBundle(!isInitial), { maxAttempts: 8, delayMs: 2_500 });
      const [home, recruitingBoard, live] = await Promise.all([
        fetchHome(),
        fetchWithWarmPoll(() => fetchRecruitingBoard(2027), { maxAttempts: 6 }).catch(() => null),
        fetchWithWarmPoll(() => fetchLiveHubBundle(!isInitial), { maxAttempts: 6 }).catch(() => null),
      ]);
      setBundle(home);
      setBoard(recruitingBoard);
      const highlights = filterExcludedPortalClassItems(
        live?.panels.beatWriterHighlights.filter((item) => item.text?.trim()) ?? [],
        (item) => item.text,
        (item) => ({ source: item.source })
      );
      setBeatItems(highlights);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, HOME_REFRESH.ticker);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  const heroTickerItems = useMemo(() => buildHeroTickerItems(bundle), [bundle]);
  const gameDay = useMemo(() => buildGameDayView(), []);

  const recruitingMetrics = useMemo(
    () => buildRecruitingMetricsView(bundle.recruiting, board, bundle.movement),
    [bundle.recruiting, bundle.movement, board]
  );

  const futureCastTargets = useMemo(
    () => buildFutureCastTargets(bundle.movement, board),
    [bundle.movement, board]
  );

  const beatPosts = useMemo(() => buildBeatPosts(beatItems), [beatItems]);

  return (
    <div className="home-wow-page" data-testid="vault-home-premium">
      <HomeCommandCenter
        heroTickerItems={heroTickerItems}
        gameDay={gameDay}
        recruitingMetrics={recruitingMetrics}
        futureCastTargets={futureCastTargets}
        beatPosts={beatPosts}
        loading={loading}
      />
    </div>
  );
}
