'use client';

/**
 * Player Profile 2.0 — full page shell.
 * Route: /futurecast/player/:slug
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPlayerProfile, type PlayerProfileBundle } from '../../../lib/player-api';
import { fetchPortalPredictions, type PortalIntelPayload, type TransferPrediction } from '../../../lib/portal-api';
import { fetchUfFitIntel, type UfFitIntelResponse } from '../../../lib/uf-fit-api';
import { computePlayerMetrics } from '../../../lib/player-derived';
import '../../../lib/futurecast.css';
import { PlayerHeader } from './PlayerHeader';
import { PlayerTabs, parseProfileTab, type ProfileTabId } from './PlayerTabs';
import { OverviewTab } from './OverviewTab';
import { HighSchoolTab } from './HighSchoolTab';
import { CollegeTab } from './CollegeTab';
import { PortalTab } from './PortalTab';
import { UFFitTab } from './UFFitTab';
import { SignalsTab } from './SignalsTab';

export interface PlayerProfilePageProps {
  slug: string;
}

function ProfileSkeleton(): React.ReactElement {
  return (
    <div className="fc-profile-skeleton" data-testid="player-profile-loading">
      <div className="fc-skeleton fc-skeleton--title" />
      <div className="fc-skeleton fc-skeleton--line" />
      <div className="fc-skeleton fc-skeleton--scores" />
      <div className="fc-skeleton fc-skeleton--tabs" />
      <div className="fc-skeleton fc-skeleton--panel" />
    </div>
  );
}

export function PlayerProfilePage({ slug }: PlayerProfilePageProps): React.ReactElement {
  const [data, setData] = useState<PlayerProfileBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalIntel, setPortalIntel] = useState<PortalIntelPayload | null>(null);
  const [portalPredictions, setPortalPredictions] = useState<TransferPrediction[]>([]);
  const [portalIntelLoading, setPortalIntelLoading] = useState(false);
  const [ufFitIntel, setUfFitIntel] = useState<UfFitIntelResponse | null>(null);
  const [ufFitIntelLoading, setUfFitIntelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>(() => {
    if (typeof window === 'undefined') return 'overview';
    return parseProfileTab(new URLSearchParams(window.location.search).get('tab'));
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPortalIntel(null);
    setPortalPredictions([]);
    setUfFitIntel(null);
    fetchPlayerProfile(slug)
      .then((bundle) => {
        if (!cancelled) setData(bundle);
        const tasks: Promise<void>[] = [];
        const lifecycle = bundle.player.status;
        if (lifecycle === 'COLLEGE' || lifecycle === 'PORTAL' || bundle.portalProfile) {
          setPortalIntelLoading(true);
          tasks.push(
            fetchPortalPredictions(bundle.player.id)
              .then((res) => {
                if (!cancelled) {
                  setPortalIntel(res.intel);
                  setPortalPredictions(res.predictions);
                }
              })
              .catch(() => {})
              .finally(() => {
                if (!cancelled) setPortalIntelLoading(false);
              })
          );
        }
        if (bundle.ufSpecificProfile) {
          setUfFitIntelLoading(true);
          tasks.push(
            fetchUfFitIntel(bundle.player.id)
              .then((res) => {
                if (!cancelled) setUfFitIntel(res);
              })
              .catch(() => {})
              .finally(() => {
                if (!cancelled) setUfFitIntelLoading(false);
              })
          );
        }
        return tasks.length ? Promise.all(tasks).then(() => undefined) : undefined;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load player');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const onTabChange = useCallback((tab: ProfileTabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'overview') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const metrics = useMemo(() => {
    if (!data) return null;
    const base = computePlayerMetrics(
      data.player,
      data.ufSpecificProfile,
      data.portalProfile,
      data.collegeProfile,
      data.signals
    );
    let result = base;
    if (ufFitIntel) {
      result = { ...result, ufFitScore: ufFitIntel.ufFitScore, ufFitTier: ufFitIntel.fitTier };
    }
    if (portalIntel) {
      result = {
        ...result,
        portalLikelihoodPct: Math.round(portalIntel.portalLikelihood * 100),
        portalColor: portalIntel.portalLikelihood >= 0.7 ? 'high' as const : portalIntel.portalLikelihood >= 0.4 ? 'medium' as const : 'low' as const,
      };
    }
    return result;
  }, [data, portalIntel, ufFitIntel]);

  const availableTabs = useMemo(
    () => ({
      'high-school': !!data?.highSchoolProfile,
      college: !!data?.collegeProfile,
      portal:
        !!data?.portalProfile ||
        data?.player.status === 'COLLEGE' ||
        data?.player.status === 'PORTAL',
      'uf-fit': !!data?.ufSpecificProfile,
    }),
    [data]
  );

  if (loading) return <ProfileSkeleton />;
  if (error || !data || !metrics) {
    return (
      <div className="fc-profile-error" data-testid="player-profile-error">
        <p>{error || 'Player not found'}</p>
        <a href="/futurecast">← FutureCast</a>
      </div>
    );
  }

  return (
    <div className="fc-profile-page" data-testid="player-profile-page">
      <nav className="fc-profile-back">
        <a href="/futurecast">← FutureCast</a>
      </nav>
      <PlayerHeader player={data.player} metrics={metrics} portalProfile={data.portalProfile} />
      <PlayerTabs activeTab={activeTab} onTabChange={onTabChange} availableTabs={availableTabs} />
      <div className="fc-profile-tab-panel" role="tabpanel">
        {activeTab === 'overview' && <OverviewTab data={data} metrics={metrics} />}
        {activeTab === 'high-school' && (
          <HighSchoolTab player={data.player} profile={data.highSchoolProfile} />
        )}
        {activeTab === 'college' && <CollegeTab profile={data.collegeProfile} />}
        {activeTab === 'portal' && (
          <PortalTab
            player={data.player}
            profile={data.portalProfile}
            collegeProfile={data.collegeProfile}
            signals={data.signals}
            intel={portalIntel}
            predictions={portalPredictions}
            intelLoading={portalIntelLoading}
          />
        )}
        {activeTab === 'uf-fit' && (
          <UFFitTab
            profile={data.ufSpecificProfile}
            intel={ufFitIntel}
            intelLoading={ufFitIntelLoading}
          />
        )}
        {activeTab === 'signals' && <SignalsTab signals={data.signals} />}
      </div>
    </div>
  );
}

export default PlayerProfilePage;
