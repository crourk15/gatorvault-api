'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/home-wow.css';
import { HOME_REFRESH } from '@/lib/vault-home-api';
import { fetchRecruitingBoard, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHubTicker } from '@/lib/recruiting-hub-elite-api';
import { useVaultDataReload } from '@/lib/vault-navigation';
import { fetchWithWarmPoll } from '@/lib/api-warm-poll';
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
import type { MovementIntelResponse } from '@/lib/movement-intel-types';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';
import {
  buildBeatPostsFromIntel,
  buildFutureCastTargetsFromHome,
  buildGameDayView,
  buildHeroTickerFromTrust,
  mapClassMetricsToHomeView,
} from '@/components/home/premium/command/home-command-utils';

/** Vault home — WOW command center (hero → gameday → strip → recruiting → FC → beat). */
export function HomePremiumPage(): React.ReactElement {
  const [hubTicker, setHubTicker] = useState<string[]>([]);
  const [hpIntel, setHpIntel] = useState<HighPriorityIntelItem[]>([]);
  const [movementIntel, setMovementIntel] = useState<MovementIntelResponse | null>(null);
  const [beatIntel, setBeatIntel] = useState<BeatIntelItem[]>([]);
  const [board, setBoard] = useState<RecruitingBoardResponse | null>(null);
  const [classMetrics, setClassMetrics] = useState<Awaited<ReturnType<typeof fetchClassMetrics>> | null>(
    null
  );
  const [futureCastHome, setFutureCastHome] = useState<FutureCastHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    try {
      const year = ACTIVE_RECRUITING_CLASS_YEAR;
      const [ticker, intel, movement, beat, recruitingBoard, metrics, fcHome] = await Promise.all([
        fetchWithWarmPoll(() => fetchRecruitingHubTicker(year), { maxAttempts: 6 }).catch(() => []),
        fetchWithWarmPoll(() => fetchHighPriorityIntel(), { maxAttempts: 6 }).catch(() => []),
        fetchWithWarmPoll(() => fetchMovementIntel(), { maxAttempts: 6 }).catch(() => null),
        fetchWithWarmPoll(() => fetchBeatIntel(), { maxAttempts: 6 }).catch(() => []),
        fetchWithWarmPoll(() => fetchRecruitingBoard(year), { maxAttempts: 6 }).catch(() => null),
        fetchWithWarmPoll(() => fetchClassMetrics(), { maxAttempts: 6 }).catch(() => null),
        fetchWithWarmPoll(() => fetchFutureCastHome(), { maxAttempts: 6 }).catch(() => null),
      ]);
      setHubTicker(ticker);
      setHpIntel(intel);
      setMovementIntel(movement);
      setBeatIntel(beat);
      setBoard(recruitingBoard);
      setClassMetrics(metrics);
      setFutureCastHome(fcHome);
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

  const heroTickerItems = useMemo(
    () => buildHeroTickerFromTrust({ hubTicker, hpIntel, movement: movementIntel }),
    [hubTicker, hpIntel, movementIntel]
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
        beatPosts={beatPosts}
        loading={loading}
      />
    </div>
  );
}
