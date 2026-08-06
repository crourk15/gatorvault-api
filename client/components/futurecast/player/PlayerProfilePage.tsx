'use client';

/**
 * Player Profile 2.0 — full page shell.
 * Single aggregated API fetch + client cache.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchFullProfile,
  mapFullProfileToBundle,
  type FullProfilePayload,
} from '@/lib/player-full-profile-api';
import type { PortalIntelPayload, TransferPrediction } from '@/lib/portal-api';
import type { UfFitIntelResponse } from '@/lib/uf-fit-api';
import type { PlayerPrediction } from '@/lib/predictions-api';
import { resolveProfileMetrics } from '@/lib/player-profile-normalize';
import '@/lib/futurecast.css';
import { PlayerHeader } from './PlayerHeader';
import { PlayerTabs, parseProfileTab, type ProfileTabId } from './PlayerTabs';
import { OverviewTab } from './OverviewTab';
import { HighSchoolTab } from './HighSchoolTab';
import { CollegeTab } from './CollegeTab';
import { PortalTab } from './PortalTab';
import { UFFitTab } from './UFFitTab';
import { SignalsTab } from './SignalsTab';
import { UiError } from '@/components/site/UiMessage';
import { usePathname } from '@/lib/use-pathname';
import { futureCastBase, isVaultPath } from '@/lib/vault-routes';
import { readProfileCache, profileCacheKey } from '@/lib/profile-cache';

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

export interface PlayerProfilePageProps {
  slug: string;
  playerId?: string | null;
  backHref?: string;
  backLabel?: string;
  recruitingContext?: boolean;
}

export function PlayerProfilePage({
  slug,
  playerId: playerIdProp,
  backHref: backHrefProp,
  backLabel: backLabelProp,
  recruitingContext = false,
}: PlayerProfilePageProps): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const isRecruitingProfileRoute =
    recruitingContext || pathname.includes('/recruiting/player/');
  const backHref = backHrefProp ?? (isRecruitingProfileRoute ? '/vault/recruiting' : futureCastBase(pathname));
  const backLabel =
    backLabelProp ?? (isRecruitingProfileRoute ? '← Recruiting Hub' : inVault ? '← FutureCast' : '← FutureCast');

  const cacheKey = profileCacheKey(slug, playerIdProp);
  const cached = readProfileCache(cacheKey);

  const [profile, setProfile] = useState<FullProfilePayload | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('overview');

  useEffect(() => {
    setActiveTab(parseProfileTab(new URLSearchParams(window.location.search).get('tab')));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const instant = readProfileCache(cacheKey);
    if (instant) {
      setProfile(instant);
      setLoading(false);
      setError(null);
    } else {
      // Drop prior slug's profile so we never flash another player's HS/location.
      setProfile(null);
      setLoading(true);
      setError(null);
    }

    void fetchFullProfile(slug, { playerId: playerIdProp })
      .then((payload) => {
        if (cancelled) return;
        setProfile(payload);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!instant) {
          setError(err instanceof Error ? err.message : 'Failed to load player');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, playerIdProp, cacheKey]);

  const onTabChange = useCallback((tab: ProfileTabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'overview') url.searchParams.delete('tab');
      else url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const data = useMemo(() => (profile ? mapFullProfileToBundle(profile) : null), [profile]);
  const portalIntel = profile?.portalPredictions?.intel ?? null;
  const portalPredictions = profile?.portalPredictions?.predictions ?? [];
  const ufFitIntel = profile?.fitIntel ?? null;

  const initialPredictions = useMemo((): PlayerPrediction[] | undefined => {
    const raw = profile?.portalPredictions?.predictions;
    if (!raw?.length) return undefined;
    const now = profile?.lastUpdated ?? new Date().toISOString();
    return raw.map((p, i) => {
      const row = p as {
        school: string;
        score: number;
        sourceType?: PlayerPrediction['sourceType'];
        predictorId?: string;
        status?: PlayerPrediction['status'];
      };
      return {
        id: `${profile?.player?.id ?? 'pick'}-${i}`,
        school: row.school,
        confidence: Math.round(Number(row.score)),
        sourceType: row.sourceType ?? 'MODEL',
        predictorId: row.predictorId ?? 'gatorvault',
        status: row.status ?? 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
    });
  }, [profile]);

  const metrics = useMemo(() => {
    if (!data || !profile) return null;
    const base = resolveProfileMetrics({
      player: data.player,
      ufSpecificProfile: data.ufSpecificProfile,
      portalProfile: data.portalProfile,
      collegeProfile: data.collegeProfile,
      signals: data.signals,
      futurecastSummary: profile.futurecastSummary,
      fitIntel: ufFitIntel,
      movementWindow: profile.movementWindow,
    });
    if (ufFitIntel && !base.ufFitLabel) {
      return {
        ...base,
        ufFitScore: ufFitIntel.ufFitScore ?? base.ufFitScore,
        ufFitTier: (ufFitIntel.fitTier as typeof base.ufFitTier) ?? base.ufFitTier,
      };
    }
    if (portalIntel && !base.portalHidden) {
      return {
        ...base,
        portalLikelihoodPct: Math.round(portalIntel.portalLikelihood * 100),
        portalColor:
          portalIntel.portalLikelihood >= 0.7
            ? ('high' as const)
            : portalIntel.portalLikelihood >= 0.4
              ? ('medium' as const)
              : ('low' as const),
      };
    }
    return base;
  }, [data, profile, portalIntel, ufFitIntel]);

  const availableTabs = useMemo(
    () => ({
      'high-school': !!data?.highSchoolProfile,
      college: !!data?.collegeProfile,
      portal:
        !!data?.portalProfile ||
        data?.player.status === 'COLLEGE' ||
        data?.player.status === 'PORTAL',
      'uf-fit': !!data?.ufSpecificProfile || !!profile?.fitIntel,
    }),
    [data, profile?.fitIntel]
  );

  if (loading && !profile) {
    return (
      <div className="fc-profile-page fc-profile-page--feed mobile-app" data-testid="player-profile-page">
        <nav className="fc-profile-back">
          <a href={backHref}>{backLabel}</a>
        </nav>
        <ProfileSkeleton />
      </div>
    );
  }

  if (error || !data || !metrics) {
    return (
      <UiError
        title="Player not found"
        message={
          error ||
          'This profile is not available in FutureCast. Portal and college players are listed in the Player Directory.'
        }
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  return (
    <div className="fc-profile-page fc-profile-page--feed mobile-app" data-testid="player-profile-page">
      <nav className="fc-profile-back">
        <a href={backHref}>{backLabel}</a>
      </nav>
      <PlayerHeader
        player={data.player}
        metrics={metrics}
        portalProfile={data.portalProfile}
        futurecastSummary={profile?.futurecastSummary ?? null}
        movementWindow={profile?.movementWindow ?? null}
      />
      <PlayerTabs activeTab={activeTab} onTabChange={onTabChange} availableTabs={availableTabs} />
      <div className="fc-profile-tab-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <OverviewTab
            data={data}
            metrics={metrics}
            competingSchools={profile?.competingSchools ?? []}
            futurecastSummary={profile?.futurecastSummary ?? null}
            initialPredictions={initialPredictions}
            vaultScouting={profile?.vaultScouting ?? null}
          />
        )}
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
            intel={portalIntel as PortalIntelPayload | null}
            predictions={portalPredictions as TransferPrediction[]}
            intelLoading={false}
          />
        )}
        {activeTab === 'uf-fit' && (
          <UFFitTab profile={data.ufSpecificProfile} intel={ufFitIntel as UfFitIntelResponse | null} intelLoading={false} />
        )}
        {activeTab === 'signals' && (
          <SignalsTab
            signals={data.signals}
            offerCount={data.highSchoolProfile?.offers?.length ?? 0}
          />
        )}
      </div>
    </div>
  );
}

export default PlayerProfilePage;
