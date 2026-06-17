'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@/lib/vault-home.css';
import '@/components/home/home-shared.css';
import { HomeTopCommandCard } from '@/components/home/HomeTopCommandCard';
import { HomeLiveSurface } from '@/components/home/HomeLiveSurface';
import { HomeGatorNationPreview } from '@/components/home/HomeGatorNationPreview';
import { HomeRecruitingSnapshot } from '@/components/home/HomeRecruitingSnapshot';
import { HomeFutureCastSnapshot } from '@/components/home/HomeFutureCastSnapshot';
import { HomeTeamSnapshot } from '@/components/home/HomeTeamSnapshot';
import { HomePortalTracker } from '@/components/home/HomePortalTracker';
import { HomeNilTrends } from '@/components/home/HomeNilTrends';
import { HomeUpcomingGames } from '@/components/home/HomeUpcomingGames';
import { HomeCTASection } from '@/components/home/HomeCTASection';
import {
  HOME_REFRESH,
  computeMomentumPct,
  fetchContentLatest,
  fetchLiveTicker,
  fetchMovementPreview,
  fetchPersonalizedHints,
  fetchRecruitingSnapshot,
  type ContentLatestResponse,
  type PersonalizedResponse,
  type RecruitingSnapshot,
  type TickerResponse,
} from '@/lib/vault-home-api';
import { fetchFutureCastClass } from '@/lib/futurecast-home-api';

const TICKER_DEBOUNCE_MS = 400;

export function VaultHomePage(): React.ReactElement {
  const [ticker, setTicker] = useState<TickerResponse | null>(null);
  const [movement, setMovement] = useState<Awaited<ReturnType<typeof fetchMovementPreview>> | null>(null);
  const [content, setContent] = useState<ContentLatestResponse | null>(null);
  const [recruiting, setRecruiting] = useState<RecruitingSnapshot | null>(null);
  const [personalized, setPersonalized] = useState<PersonalizedResponse | null>(null);
  const [momentumPct, setMomentumPct] = useState(72);
  const [movementDelta, setMovementDelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const tickerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyTicker = useCallback((data: TickerResponse) => {
    if (tickerDebounceRef.current) clearTimeout(tickerDebounceRef.current);
    tickerDebounceRef.current = setTimeout(() => {
      setTicker(data);
    }, TICKER_DEBOUNCE_MS);
  }, []);

  const loadTicker = useCallback(
    async (force = false) => {
      try {
        const data = await fetchLiveTicker(force);
        applyTicker(data);
      } catch {
        /* keep prior */
      }
    },
    [applyTicker]
  );

  const loadMovement = useCallback(async (force = false) => {
    try {
      const [data, classData] = await Promise.all([
        fetchMovementPreview(force),
        fetchFutureCastClass().catch(() => null),
      ]);
      setMovement(data);
      const pct = computeMomentumPct(
        data.heatmap,
        classData?.rankings?.classScore ?? classData?.classImpactScore
      );
      setMomentumPct(pct);
      const topRiser = data.topRisers?.[0];
      setMovementDelta(topRiser?.delta ?? null);
    } catch {
      /* keep prior */
    }
  }, []);

  const loadRecruiting = useCallback(async (force = false) => {
    try {
      const data = await fetchRecruitingSnapshot(force);
      setRecruiting(data);
    } catch {
      /* keep prior */
    }
  }, []);

  const loadContent = useCallback(async (force = false) => {
    try {
      const data = await fetchContentLatest(force);
      setContent(data);
    } catch {
      /* keep prior */
    }
  }, []);

  const loadPersonalized = useCallback(async () => {
    try {
      const data = await fetchPersonalizedHints();
      setPersonalized(data);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const [tickerData] = await Promise.all([
        fetchLiveTicker(true).catch(() => null),
        loadMovement(true),
        loadRecruiting(true),
        loadContent(true),
        loadPersonalized(),
      ]);
      if (tickerData) setTicker(tickerData);
      if (!cancelled) setLoading(false);
    }

    void boot();

    const tickerTimer = window.setInterval(() => void loadTicker(true), HOME_REFRESH.ticker);
    const movementTimer = window.setInterval(() => void loadMovement(true), HOME_REFRESH.movement);
    const contentTimer = window.setInterval(() => void loadContent(true), HOME_REFRESH.movement);
    const recruitingTimer = window.setInterval(() => void loadRecruiting(true), HOME_REFRESH.recruiting);
    const personalTimer = window.setInterval(() => void loadPersonalized(), 60_000);

    return () => {
      cancelled = true;
      if (tickerDebounceRef.current) clearTimeout(tickerDebounceRef.current);
      window.clearInterval(tickerTimer);
      window.clearInterval(movementTimer);
      window.clearInterval(contentTimer);
      window.clearInterval(recruitingTimer);
      window.clearInterval(personalTimer);
    };
  }, [loadContent, loadMovement, loadPersonalized, loadRecruiting, loadTicker]);

  return (
    <div className="gv-home gv-home-shell" data-testid="vault-home">
      <div className="gv-home__frame gv-home__command">
        <div className="gv-home__grid">
          <HomeTopCommandCard
            ticker={ticker}
            snapshot={recruiting}
            momentumPct={momentumPct}
            movementDelta={movementDelta}
            loading={loading && !recruiting}
          />

          <HomeLiveSurface
            tickerItems={ticker?.items ?? []}
            movement={movement}
            content={content}
            loading={loading && !movement && !content}
          />

          <HomeGatorNationPreview ticker={ticker} />

          <HomeRecruitingSnapshot
            snapshot={recruiting}
            movement={movement}
            personalized={personalized}
            tickerItems={ticker?.items ?? []}
            loading={loading && !recruiting}
          />

          <HomeFutureCastSnapshot data={movement} loading={loading && !movement} />

          <HomeTeamSnapshot />

          <HomePortalTracker snapshot={recruiting} />

          <HomeNilTrends snapshot={recruiting} />

          <HomeUpcomingGames />

          <HomeCTASection />
        </div>
      </div>
    </div>
  );
}
