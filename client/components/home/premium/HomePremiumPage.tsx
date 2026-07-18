'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/home-wow.css';
import { HOME_REFRESH } from '@/lib/vault-home-api';
import { fetchRecruitingBoard, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHubBundle } from '@/lib/recruiting-hub-elite-api';
import { useVaultDataReload } from '@/lib/vault-navigation';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
import { warmPollProfile } from '@/lib/warm-poll-profile';
import { HomeCommandCenter } from '@/components/home/premium/command/HomeCommandCenter';
import {
  fetchBeatIntel,
  fetchHighPriorityIntel,
  fetchMovementIntel,
  type BeatIntelItem,
  type ClassMetricsResponse,
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
  buildHomePulseHeadline,
} from '@/components/home/premium/command/home-command-utils';

declare global {
  interface Window {
    __GV_HOME_WOW__?: {
      metrics?: ClassMetricsResponse;
      futureCastTargets?: unknown[];
      beatItems?: BeatIntelItem[];
    };
  }
}

function readBootMetrics(): ClassMetricsResponse | null {
  if (typeof window === 'undefined') return null;
  const fromBoot = window.__GV_HOME_WOW__?.metrics;
  if (fromBoot) return fromBoot;
  try {
    const year = ACTIVE_RECRUITING_CLASS_YEAR;
    const raw = sessionStorage.getItem(`gv_class_metrics_v1:${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: ClassMetricsResponse };
    if (!parsed?.data || Date.now() - parsed.at > 5 * 60_000) return null;
    return parsed.data;
  } catch {
    return null;
  }
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
  // SSR-safe init — apply session/boot cache only in useEffect to avoid hydration mismatch.
  const [beatIntel, setBeatIntel] = useState<BeatIntelItem[]>([]);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [classMetrics, setClassMetrics] = useState<ClassMetricsResponse | null>(null);
  const [futureCastHome, setFutureCastHome] = useState<FutureCastHomeResponse | null>(null);
  const [highPriority, setHighPriority] = useState<HighPriorityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [beatReady, setBeatReady] = useState(false);

  useEffect(() => {
    function applyBootCache(): void {
      const metrics = readBootMetrics();
      if (metrics) {
        setClassMetrics(metrics);
        setLoading(false);
      }
      const beat = readBootBeat();
      if (beat.length > 0) {
        setBeatIntel(beat);
        setBeatReady(true);
      }
      const boot = window.__GV_HOME_WOW__;
      if (boot?.metrics) {
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
  }, []);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial && readBootMetrics()) {
      setLoading(false);
    } else if (isInitial) {
      setLoading(true);
    }
    const poll = warmPollProfile();
    try {
      const year = ACTIVE_RECRUITING_CLASS_YEAR;
      const [hubBundle, intel, movement, beat, recruitingBoard, fcHome, hpTargets] =
        await Promise.all([
          fetchWithWarmPoll(() => fetchRecruitingHubBundle(year), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchHighPriorityIntel(), poll).catch(() => []),
          fetchWithWarmPoll(() => fetchMovementIntel(), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchBeatIntel(), poll).catch(() => []),
          fetchWithWarmPoll(() => fetchRecruitingBoard(year), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchFutureCastHome(), poll).catch(() => null),
          fetchWithWarmPoll(() => fetchHighPriorityTargets(year), poll).catch(() => null),
        ]);
      setHubTicker(hubBundle?.ticker ?? []);
      setHpIntel(intel);
      setMovementIntel(movement);
      setBeatIntel(beat);
      setBoard(recruitingBoard);
      setClassMetrics(hubBundle?.classOverview ? { ...hubBundle.classOverview } : null);
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

  const pulseHeadline = useMemo(
    () =>
      buildHomePulseHeadline({
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

  const futureCastTargets = useMemo(
    () => buildFutureCastTargetsFromHome(futureCastHome, movementIntel, board),
    [futureCastHome, movementIntel, board]
  );

  const beatPosts = useMemo(() => buildBeatPostsFromIntel(beatIntel), [beatIntel]);

  return (
    <div className="home-wow-page" data-testid="vault-home-premium">
      <HomeCommandCenter
        pulseHeadline={pulseHeadline}
        gameDay={gameDay}
        futureCastTargets={futureCastTargets}
        beatPosts={beatPosts}
        loading={loading}
        beatLoading={!beatReady}
      />
    </div>
  );
}
