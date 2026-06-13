'use client';

/**
 * Portal / college player profile — separate from FutureCast HS profiles.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPlayerProfile, type PlayerProfileBundle } from '@/lib/player-api';
import { fetchPortalPredictions, type PortalIntelPayload, type TransferPrediction } from '@/lib/portal-api';
import { computePlayerMetrics } from '@/lib/player-derived';
import { playerLifecycleKind, playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath, vaultPortalBackHref, vaultPortalBackLabel } from '@/lib/vault-routes';
import { UiError } from '@/components/site/UiMessage';
import { PlayerHeader } from '@/components/futurecast/player/PlayerHeader';
import { PortalTab } from '@/components/futurecast/player/PortalTab';
import { CollegeTab } from '@/components/futurecast/player/CollegeTab';
import { SignalsTab } from '@/components/futurecast/player/SignalsTab';
import '@/lib/futurecast.css';

type PortalTabId = 'overview' | 'portal' | 'college' | 'signals';

function ProfileSkeleton(): React.ReactElement {
  return (
    <div className="fc-profile-skeleton" data-testid="portal-profile-loading">
      <div className="fc-skeleton fc-skeleton--title" />
      <div className="fc-skeleton fc-skeleton--line" />
      <div className="fc-skeleton fc-skeleton--panel" />
    </div>
  );
}

function BioSection({ data }: { data: PlayerProfileBundle }): React.ReactElement {
  const p = data.player;
  const notes =
    data.highSchoolProfile?.recruitingNotes ||
    data.collegeProfile?.stats?.bio ||
    data.portalProfile?.likelihoodReason ||
    null;

  return (
    <section className="fc-profile-section gv-portal-bio">
      <h2>Bio</h2>
      <dl className="fc-profile-dl">
        {p.highSchool && (
          <div>
            <dt>High School</dt>
            <dd>{p.highSchool}</dd>
          </div>
        )}
        {data.collegeProfile?.college && (
          <div>
            <dt>College</dt>
            <dd>{data.collegeProfile.college}</dd>
          </div>
        )}
        {data.portalProfile?.previousSchool && (
          <div>
            <dt>Previous School</dt>
            <dd>{data.portalProfile.previousSchool}</dd>
          </div>
        )}
        {p.committedTo && (
          <div>
            <dt>Committed To</dt>
            <dd>{p.committedTo}</dd>
          </div>
        )}
      </dl>
      {notes && typeof notes === 'string' && (
        <p className="fc-profile-muted">{notes}</p>
      )}
    </section>
  );
}

export function PortalProfilePage({ slug }: { slug: string }): React.ReactElement {
  const pathname = usePathname();
  const backHref = vaultPortalBackHref(pathname);
  const backLabel = vaultPortalBackLabel(pathname);
  const [data, setData] = useState<PlayerProfileBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalIntel, setPortalIntel] = useState<PortalIntelPayload | null>(null);
  const [portalPredictions, setPortalPredictions] = useState<TransferPrediction[]>([]);
  const [portalIntelLoading, setPortalIntelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTabId>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPortalIntel(null);
    setPortalPredictions([]);
    try {
      const bundle = await fetchPlayerProfile(slug);
      const kind = playerLifecycleKind(bundle.player.status);
      if (kind === 'hs' && !bundle.portalProfile && bundle.player.status === 'HS') {
        window.location.replace(
          playerProfilePath(slug, bundle.player.status, isVaultPath(pathname))
        );
        return;
      }
      setData(bundle);
      setPortalIntelLoading(true);
      try {
        const res = await fetchPortalPredictions(bundle.player.id);
        setPortalIntel(res.intel);
        setPortalPredictions(res.predictions);
      } catch {
        /* portal intel optional */
      } finally {
        setPortalIntelLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this player profile.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, pathname]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const base = computePlayerMetrics(
      data.player,
      data.ufSpecificProfile,
      data.portalProfile,
      data.collegeProfile,
      data.signals
    );
    if (portalIntel) {
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
  }, [data, portalIntel]);

  if (loading) return <ProfileSkeleton />;

  if (error || !data || !metrics) {
    const isTransient =
      !!error &&
      (/temporarily unavailable|502|503|504/i.test(error) ||
        /try again/i.test(error));
    return (
      <UiError
        title={isTransient ? 'Profile temporarily unavailable' : 'Profile not found'}
        message={
          error ||
          'We could not find a portal profile for this player. They may be listed as a high school recruit instead.'
        }
        retry={() => void load()}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  const tabs: { id: PortalTabId; label: string; show: boolean }[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'portal', label: 'Portal Intel', show: true },
    { id: 'college', label: 'College', show: !!data.collegeProfile },
    { id: 'signals', label: 'Signals', show: data.signals.length > 0 },
  ];

  return (
    <div className="fc-profile-page gv-portal-profile" data-testid="portal-profile-page">
      <nav className="fc-profile-back">
        <a href={backHref}>{backLabel}</a>
      </nav>
      <PlayerHeader player={data.player} metrics={metrics} portalProfile={data.portalProfile} />

      <div className="fc-profile-tabs" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`fc-profile-tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <div className="fc-profile-tab-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <>
            <BioSection data={data} />
            {metrics.portalLikelihoodPct != null && (
              <section className="fc-profile-section">
                <h2>Portal Outlook</h2>
                <p className="gv-portal-metric-lg">{metrics.portalLikelihoodPct}% portal likelihood</p>
              </section>
            )}
          </>
        )}
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
        {activeTab === 'college' && data.collegeProfile && (
          <CollegeTab profile={data.collegeProfile} />
        )}
        {activeTab === 'signals' && <SignalsTab signals={data.signals} />}
      </div>
    </div>
  );
}
