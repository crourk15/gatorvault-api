'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@/lib/vault-dashboard.css';
import { DashboardHero } from '@/components/vault/dashboard/DashboardHero';
import { DashboardTicker } from '@/components/vault/dashboard/DashboardTicker';
import { DashboardQuickStats } from '@/components/vault/dashboard/DashboardQuickStats';
import { DashboardRecruitingSnapshot } from '@/components/vault/dashboard/DashboardRecruitingSnapshot';
import { DashboardFutureCastSnapshot } from '@/components/vault/dashboard/DashboardFutureCastSnapshot';
import { DashboardPortalActivity } from '@/components/vault/dashboard/DashboardPortalActivity';
import { DashboardNilTrends } from '@/components/vault/dashboard/DashboardNilTrends';
import { DashboardGatorNationPreview } from '@/components/vault/dashboard/DashboardGatorNationPreview';
import { DashboardTeamSnapshot } from '@/components/vault/dashboard/DashboardTeamSnapshot';
import {
  DASHBOARD_REFRESH,
  computeMomentumPct,
  fetchLiveTicker,
  fetchMovementPreview,
  fetchPersonalizedHints,
  fetchRecruitingSnapshot,
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
        loadPersonalized(),
      ]);
      if (tickerData) setTicker(tickerData);
      if (!cancelled) setLoading(false);
    }

    void boot();

    const tickerTimer = window.setInterval(() => void loadTicker(true), DASHBOARD_REFRESH.ticker);
    const movementTimer = window.setInterval(() => void loadMovement(true), DASHBOARD_REFRESH.movement);
    const recruitingTimer = window.setInterval(() => void loadRecruiting(true), DASHBOARD_REFRESH.recruiting);
    const personalTimer = window.setInterval(() => void loadPersonalized(), 60_000);

    return () => {
      cancelled = true;
      if (tickerDebounceRef.current) clearTimeout(tickerDebounceRef.current);
      window.clearInterval(tickerTimer);
      window.clearInterval(movementTimer);
      window.clearInterval(recruitingTimer);
      window.clearInterval(personalTimer);
    };
  }, [loadMovement, loadPersonalized, loadRecruiting, loadTicker]);

  return (
    <div className="gv-dash gv-dash-shell" data-testid="vault-dashboard">
      <section className="gv-dash-hero-section" aria-label="Hero section">
        <DashboardHero ticker={ticker} loading={loading && !ticker} />
        <DashboardTicker items={ticker?.items ?? []} loading={loading && !ticker} />
      </section>

      <div className="gv-dash__frame gv-dash__command">
        <div className="gv-dash__grid">
          <div className="gv-dash__cell gv-dash__cell--12">
            <DashboardQuickStats
              snapshot={recruiting}
              momentumPct={momentumPct}
              movementDelta={movementDelta}
              loading={loading && !recruiting}
            />
          </div>

          <div className="gv-dash__cell gv-dash__cell--8">
            <DashboardRecruitingSnapshot
              snapshot={recruiting}
              movement={movement}
              personalized={personalized}
              tickerItems={ticker?.items ?? []}
              loading={loading && !recruiting}
            />
          </div>

          <div className="gv-dash__cell gv-dash__cell--4">
            <DashboardFutureCastSnapshot data={movement} loading={loading && !movement} />
          </div>

          <div className="gv-dash__cell gv-dash__cell--6">
            <DashboardPortalActivity snapshot={recruiting} />
          </div>

          <div className="gv-dash__cell gv-dash__cell--6">
            <DashboardNilTrends snapshot={recruiting} />
          </div>

          <div className="gv-dash__cell gv-dash__cell--12">
            <DashboardGatorNationPreview ticker={ticker} />
          </div>

          <div className="gv-dash__cell gv-dash__cell--12">
            <DashboardTeamSnapshot />
          </div>
        </div>
      </div>
    </div>
  );
}
