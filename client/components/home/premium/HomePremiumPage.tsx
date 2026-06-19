'use client';

import React, { useCallback, useEffect, useState } from 'react';
import '@/lib/uf-premium-home.css';
import {
  fetchHomeBundle,
  HOME_REFRESH,
  type HomeBundle,
} from '@/lib/vault-home-api';
import { fetchTeamHubBundle, type TeamHubBundle } from '@/lib/team-hub-api';
import { useVaultDataReload } from '@/lib/vault-navigation';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { HomePremiumHero } from '@/components/home/premium/HomePremiumHero';
import { HomePremiumSection } from '@/components/home/premium/HomePremiumSection';
import { HomeRecruitingPreview } from '@/components/home/premium/HomeRecruitingPreview';
import { HomeFutureCastPreview } from '@/components/home/premium/HomeFutureCastPreview';
import { HomeTeamPreview } from '@/components/home/premium/HomeTeamPreview';
import { HomeNilPreview } from '@/components/home/premium/HomeNilPreview';
import { HomeSchedulePreview } from '@/components/home/premium/HomeSchedulePreview';
import { HomeContentPreview } from '@/components/home/premium/HomeContentPreview';

const EMPTY_BUNDLE: HomeBundle = {
  ticker: null,
  movement: null,
  content: null,
  recruiting: null,
  momentumPct: 0,
  personalized: null,
  portal: null,
  team: null,
  nil: null,
  schedule: null,
};

const EMPTY_TEAM: TeamHubBundle = {
  eras: [],
  achievements: [],
  identity: [],
  coaches: [],
  roster: [],
  depthChart: { offense: [], defense: [], specialTeams: [] },
  commandStats: { rosterCount: 0, startersLocked: 0, positionBattles: 0, updatedLabel: '—' },
  updatedAt: null,
};

/** UF Premium home — wireframe-exact sections wired to vault home APIs. */
export function HomePremiumPage(): React.ReactElement {
  const [bundle, setBundle] = useState<HomeBundle>(EMPTY_BUNDLE);
  const [teamBundle, setTeamBundle] = useState<TeamHubBundle>(EMPTY_TEAM);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    try {
      const [home, team] = await Promise.all([
        fetchHomeBundle(!isInitial),
        fetchTeamHubBundle().catch(() => EMPTY_TEAM),
      ]);
      setBundle(home);
      setTeamBundle(team);
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

  return (
    <div className="uf-premium-home" data-testid="vault-home-premium">
      <HomePremiumHero />

      <div className="uf-premium-home__frame">
        <HomePremiumSection
          title="Recruiting Hub"
          ctaLabel="Explore Recruiting Hub"
          ctaHref={VAULT_PILLAR_ROUTES.recruiting}
          testId="home-section-recruiting"
        >
          <HomeRecruitingPreview
            snapshot={bundle.recruiting}
            movement={bundle.movement}
            personalized={bundle.personalized}
            loading={loading && !bundle.recruiting}
          />
        </HomePremiumSection>

        <HomePremiumSection
          title="FutureCast"
          ctaLabel="Open FutureCast"
          ctaHref={VAULT_PILLAR_ROUTES.futurecast}
          testId="home-section-futurecast"
        >
          <HomeFutureCastPreview movement={bundle.movement} loading={loading && !bundle.movement} />
        </HomePremiumSection>

        <HomePremiumSection
          title="Team Snapshot"
          ctaLabel="View Team Page"
          ctaHref={VAULT_PILLAR_ROUTES.team}
          testId="home-section-team"
        >
          <HomeTeamPreview
            bundle={teamBundle}
            loading={loading && teamBundle.commandStats.rosterCount === 0}
          />
        </HomePremiumSection>

        <HomePremiumSection
          title="NIL Tracker"
          ctaLabel="Open NIL Command Center"
          ctaHref={VAULT_PILLAR_ROUTES.nil}
          testId="home-section-nil"
        >
          <HomeNilPreview data={bundle.nil} loading={loading && !bundle.nil} />
        </HomePremiumSection>

        <HomePremiumSection
          title="Schedule & Tickets"
          ctaLabel="View Full Schedule"
          ctaHref={VAULT_PILLAR_ROUTES.schedule}
          testId="home-section-schedule"
        >
          <HomeSchedulePreview data={bundle.schedule} loading={loading && !bundle.schedule} />
        </HomePremiumSection>

        <HomePremiumSection title="Articles / Community / Film Room" testId="home-section-content">
          <HomeContentPreview content={bundle.content} loading={loading && !bundle.content} />
        </HomePremiumSection>
      </div>
    </div>
  );
}
