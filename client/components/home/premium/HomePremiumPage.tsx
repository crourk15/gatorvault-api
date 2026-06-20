'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/home.css';
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
import { HomeCommandCenter } from '@/components/home/premium/command/HomeCommandCenter';
import {
  buildBeatPosts,
  buildFutureCastTargets,
  buildGameDayView,
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

/** Vault home — command center layout (hero → gameday → strip → recruiting → FC → beat). */
export function HomePremiumPage(): React.ReactElement {
  const [bundle, setBundle] = useState<HomeBundle>(EMPTY_BUNDLE);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [beatItems, setBeatItems] = useState<LivePanelProps['items']>([]);
  const [loading, setLoading] = useState(true);
  const [countdownTick, setCountdownTick] = useState(0);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    try {
      const [home, recruitingBoard, live] = await Promise.all([
        fetchHomeBundle(!isInitial),
        fetchRecruitingBoard(2027).catch(() => null),
        fetchLiveHubBundle(!isInitial).catch(() => null),
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

  useEffect(() => {
    const id = setInterval(() => setCountdownTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const gameDay = useMemo(() => {
    void countdownTick;
    return buildGameDayView();
  }, [countdownTick]);

  const recruitingMetrics = useMemo(
    () => buildRecruitingMetricsView(bundle.recruiting, board),
    [bundle.recruiting, board]
  );

  const futureCastTargets = useMemo(
    () => buildFutureCastTargets(bundle.movement, board),
    [bundle.movement, board]
  );

  const beatPosts = useMemo(() => buildBeatPosts(beatItems), [beatItems]);

  return (
    <div className="home-page" data-testid="vault-home-premium">
      <HomeCommandCenter
        gameDay={gameDay}
        recruitingMetrics={recruitingMetrics}
        futureCastTargets={futureCastTargets}
        beatPosts={beatPosts}
        loading={loading}
      />
    </div>
  );
}
