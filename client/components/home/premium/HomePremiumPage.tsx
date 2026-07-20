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
import { RECRUITING_HUB_HERO_SEED } from '@/lib/recruiting-hub-hero-seed';
import { GNL_HUB_SEED } from '@/lib/gnl-hub-seed';
import {
  buildBeatPostsFromIntel,
  buildFutureCastTargetsFromHome,
  buildGameDayView,
  buildHomePulseHeadline,
} from '@/components/home/premium/command/home-command-utils';

function buildSeedBeatIntel(): BeatIntelItem[] {
  return (GNL_HUB_SEED.panels?.beatWriterHighlights ?? [])
    .filter((row) => String(row.text || '').trim())
    .slice(0, 3)
    .map((row, idx) => ({
      id: `seed-beat-${idx}`,
      text: String(row.text || '').trim(),
      writerName: row.writerName || row.handle || 'Beat Writer',
      source: row.source || 'UF Beat',
      url: row.url ?? null,
      timestamp: row.timestamp || new Date().toISOString(),
    }));
}

const SEED_BEAT_INTEL = buildSeedBeatIntel();

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

/** Vault home — brand hero → gameday → strip → FutureCast → beat. */
export function HomePremiumPage(): React.ReactElement {
  const [hubTicker, setHubTicker] = useState<string[]>([]);
  const [hpIntel, setHpIntel] = useState<HighPriorityIntelItem[]>([]);
  const [movementIntel, setMovementIntel] = useState<MovementIntelResponse | null>(null);
  // Seeded beat + metrics so first paint never waits on cold intel APIs.
  const [beatIntel, setBeatIntel] = useState<BeatIntelItem[]>(SEED_BEAT_INTEL);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [classMetrics, setClassMetrics] = useState<ClassMetricsResponse | null>(
    () => ({ ...RECRUITING_HUB_HERO_SEED.classOverview }) as ClassMetricsResponse
  );
  const [futureCastHome, setFutureCastHome] = useState<FutureCastHomeResponse | null>(null);
  const [highPriority, setHighPriority] = useState<HighPriorityResponse | null>(null);
  // Seeded metrics mean first paint is never a blank recruiting snapshot.
  const [loading, setLoading] = useState(false);
  const [beatReady, setBeatReady] = useState(SEED_BEAT_INTEL.length > 0);

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
      // APIs that already warm-poll internally — do not nest another warm layer.
      const [hubBundle, intel, movement, beat, recruitingBoard, fcHome, hpTargets] =
        await Promise.all([
          fetchWithWarmPoll(() => fetchRecruitingHubBundle(year), poll).catch(() => null),
          fetchHighPriorityIntel().catch(() => []),
          fetchMovementIntel().catch(() => null),
          fetchBeatIntel().catch(() => []),
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
