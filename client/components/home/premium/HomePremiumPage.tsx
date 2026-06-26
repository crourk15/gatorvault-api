'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/home-wow.css';
import { HOME_REFRESH } from '@/lib/vault-home-api';
import { fetchRecruitingBoard, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHubTicker } from '@/lib/recruiting-hub-elite-api';
import { useVaultDataReload } from '@/lib/vault-navigation';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { warmPollProfile } from '@/lib/warm-poll-profile';
import { HomeCommandCenter } from '@/components/home/premium/command/HomeCommandCenter';
import {
  fetchBeatIntel,
  fetchClassMetrics,
  fetchHighPriorityIntel,
  fetchMovementIntel,
  type BeatIntelItem,
  type HighPriorityIntelItem,
} from '@/lib/recruiting-ui-api';
import { fetchFutureCastHome, type FutureCastHomeResponse } from '@/lib/futurecast-home-api';
import {
  fetchHighPriorityTargets,
  type FlipWatchRow,
  type HighPriorityResponse,
  type MovementNarrativeRow,
  type VisitRecapRow,
} from '@/lib/futurecast-high-priority-api';
import type { MovementIntelResponse } from '@/lib/movement-intel-types';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';
import {
  buildBeatPostsFromIntel,
  buildFutureCastTargetsFromHome,
  buildGameDayView,
  buildHeroTickerFromTrust,
  mapClassMetricsToHomeView,
} from '@/components/home/premium/command/home-command-utils';

declare global {
  interface Window {
    __GV_HOME_WOW__?: {
      metrics?: Awaited<ReturnType<typeof fetchClassMetrics>>;
      futureCastTargets?: unknown[];
      beatItems?: BeatIntelItem[];
    };
  }
}

function readBootMetrics(): Awaited<ReturnType<typeof fetchClassMetrics>> | null {
  if (typeof window === 'undefined') return null;
  return window.__GV_HOME_WOW__?.metrics ?? null;
}

function readBootBeat(): BeatIntelItem[] {
  if (typeof window === 'undefined') return [];
  return window.__GV_HOME_WOW__?.beatItems ?? [];
}

/** Vault home — WOW command center (hero → gameday → strip → recruiting → FC → beat). */
export function HomePremiumPage(): React.ReactElement {
  const [hubTicker, setHubTicker] = useState<string[]>([]);
  const [hpIntel, setHpIntel] = useState<HighPriorityIntelItem[]>([]);
  const [movementIntel, setMovementIntel] = useState<MovementIntelResponse | null>(null);
  const [beatIntel, setBeatIntel] = useState<BeatIntelItem[]>(readBootBeat);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [classMetrics, setClassMetrics] = useState<Awaited<ReturnType<typeof fetchClassMetrics>> | null>(
    readBootMetrics
  );
  const [futureCastHome, setFutureCastHome] = useState<FutureCastHomeResponse | null>(null);
  const [highPriority, setHighPriority] = useState<HighPriorityResponse | null>(null);
  const [loading, setLoading] = useState(() => !readBootMetrics());
  const [beatReady, setBeatReady] = useState(() => readBootBeat().length > 0);

  useEffect(() => {
    function applyBootCache(): void {
      const boot = window.__GV_HOME_WOW__;
      if (boot?.metrics && !classMetrics) {
        setClassMetrics(boot.metrics);
        setLoading(false);
      }
      if (boot?.beatItems?.length) {
        setBeatIntel(boot.beatItems);
        setBeatReady(true);
      }
    }
    applyBootCache();
    window.addEventListener('gv-home-wow-boot', applyBootCache);
    return () => window.removeEventListener('gv-home-wow-boot', applyBootCache);
  }, [classMetrics]);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial && readBootMetrics()) {
      setLoading(false);
    } else if (isInitial) {
      setLoading(true);
    }
    const poll = warmPollProfile();
    try {
      const year = ACTIVE_RECRUITING_CLASS_YEAR;
      const [ticker, intel, movement, beat, recruitingBoard, metrics, fcHome, hpTargets] =
        await Promise.all([
          fetchWithWarmPoll(() => fetchRecruitingHubTicker(year), poll).catch(() => []),
          fetchWithWarmPoll(() => fetchHighPriorityIntel(), poll).catch(() => []),
          fetchWithWarmPoll(() => fetchMovementIntel(), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchBeatIntel(), poll).catch(() => []),
          fetchWithWarmPoll(() => fetchRecruitingBoard(year), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchClassMetrics(), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchFutureCastHome(), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchHighPriorityTargets(year), poll).catch(() => null),
        ]);
      setHubTicker(ticker);
      setHpIntel(intel);
      setMovementIntel(movement);
      setBeatIntel(beat);
      setBoard(recruitingBoard);
      setClassMetrics(metrics);
      setFutureCastHome(fcHome);
      setHighPriority(hpTargets);
    } finally {
      if (isInitial) {
        setLoading(false);
        setBeatReady(true);
      }
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

  const flipWatch = useMemo<FlipWatchRow[]>(
    () => highPriority?.flipWatch ?? [],
    [highPriority]
  );
  const visitRecap = useMemo<VisitRecapRow[]>(
    () => highPriority?.visitRecap ?? [],
    [highPriority]
  );
  const movementNarratives = useMemo<MovementNarrativeRow[]>(
    () => highPriority?.movementNarratives ?? [],
    [highPriority]
  );

  const heroTickerItems = useMemo(
    () =>
      buildHeroTickerFromTrust({
        hubTicker,
        hpIntel,
        movement: movementIntel,
        flipWatch,
        visitRecap,
        movementNarratives,
      }),
    [hubTicker, hpIntel, movementIntel, flipWatch, visitRecap, movementNarratives]
  );
  const gameDay = useMemo(() => buildGameDayView(), []);

  const recruitingMetrics = useMemo(
    () => mapClassMetricsToHomeView(classMetrics),
    [classMetrics]
  );

  const futureCastTargets = useMemo(
    () => buildFutureCastTargetsFromHome(futureCastHome, movementIntel, board),
    [futureCastHome, movementIntel, board]
  );

  const beatPosts = useMemo(() => buildBeatPostsFromIntel(beatIntel), [beatIntel]);

  return (
    <div className="home-wow-page" data-testid="vault-home-premium">
      <HomeCommandCenter
        heroTickerItems={heroTickerItems}
        gameDay={gameDay}
        recruitingMetrics={recruitingMetrics}
        futureCastTargets={futureCastTargets}
        flipWatch={flipWatch}
        visitRecap={visitRecap}
        movementNarratives={movementNarratives}
        beatPosts={beatPosts}
        loading={loading}
        beatLoading={!beatReady}
      />
    </div>
  );
}
