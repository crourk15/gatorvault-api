'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@/lib/vault-dashboard.css';
import { DashboardHero } from '@/components/vault/dashboard/DashboardHero';
import { DashboardTicker } from '@/components/vault/dashboard/DashboardTicker';
import { DashboardTodayInVault } from '@/components/vault/dashboard/DashboardTodayInVault';
import { DashboardQuickActions } from '@/components/vault/dashboard/DashboardQuickActions';
import { DashboardWatchlist } from '@/components/vault/dashboard/DashboardWatchlist';
import { DashboardMovementFeed } from '@/components/vault/dashboard/DashboardMovementFeed';
import { DashboardUpcomingGames } from '@/components/vault/dashboard/DashboardUpcomingGames';
import { DashboardPortalActivity } from '@/components/vault/dashboard/DashboardPortalActivity';
import {
  DASHBOARD_REFRESH,
  computeMomentumPct,
  daysUntilNextGame,
  fetchContentLatest,
  fetchLiveTicker,
  fetchMovementPreview,
  fetchPersonalizedHints,
  fetchRecruitingSnapshot,
  type ContentLatestResponse,
  type PersonalizedResponse,
  type RecruitingSnapshot,
  type TickerResponse,
} from '@/lib/vault-dashboard-api';
import { fetchFutureCastClass } from '@/lib/futurecast-home-api';

const TICKER_DEBOUNCE_MS = 400;

export function VaultDashboardPage(): React.ReactElement {
  const [ticker, setTicker] = useState<TickerResponse | null>(null);
  const [movement, setMovement] = useState<Awaited<ReturnType<typeof fetchMovementPreview>> | null>(null);
  const [recruiting, setRecruiting] = useState<RecruitingSnapshot | null>(null);
  const [content, setContent] = useState<ContentLatestResponse | null>(null);
  const [personalized, setPersonalized] = useState<PersonalizedResponse | null>(null);
  const [momentumPct, setMomentumPct] = useState(72);
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
      setMomentumPct(
        computeMomentumPct(data.heatmap, classData?.rankings?.classScore ?? classData?.classImpactScore)
      );
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

    const tickerTimer = window.setInterval(() => void loadTicker(true), DASHBOARD_REFRESH.ticker);
    const movementTimer = window.setInterval(() => void loadMovement(true), DASHBOARD_REFRESH.movement);
    const recruitingTimer = window.setInterval(() => void loadRecruiting(true), DASHBOARD_REFRESH.recruiting);
    const contentTimer = window.setInterval(() => void loadContent(true), DASHBOARD_REFRESH.content);
    const personalTimer = window.setInterval(() => void loadPersonalized(), 60_000);

    return () => {
      cancelled = true;
      if (tickerDebounceRef.current) clearTimeout(tickerDebounceRef.current);
      window.clearInterval(tickerTimer);
      window.clearInterval(movementTimer);
      window.clearInterval(recruitingTimer);
      window.clearInterval(contentTimer);
      window.clearInterval(personalTimer);
    };
  }, [loadContent, loadMovement, loadPersonalized, loadRecruiting, loadTicker]);

  return (
    <div className="gv-dash" data-testid="vault-dashboard">
      <DashboardHero
        ticker={ticker}
        momentumPct={momentumPct}
        daysUntilGame={recruiting?.nextGameDays ?? daysUntilNextGame()}
        loading={loading && !ticker}
      />
      <DashboardTicker items={ticker?.items ?? []} loading={loading && !ticker} />
      <DashboardTodayInVault snapshot={recruiting} loading={loading && !recruiting} />
      <DashboardQuickActions />
      <DashboardWatchlist data={personalized} loading={loading && !personalized} />
      <DashboardMovementFeed
        movement={movement}
        content={content}
        loading={loading && !movement && !content}
      />
      <DashboardUpcomingGames />
      <DashboardPortalActivity snapshot={recruiting} />
    </div>
  );
}
