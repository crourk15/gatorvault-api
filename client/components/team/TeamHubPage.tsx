'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSeedTeamHubBundle,
  fetchTeamHubBundle,
  readCachedTeamHubBundle,
  type TeamHubBundle,
} from '@/lib/team-hub-api';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { fetchFutureCastMasterBoard } from '@/lib/futurecast-board-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import type { DepthChartTab } from '@/lib/team-hub-types';
import type { RosterFilter } from '@/lib/team-hub-data';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import { TeamPremiumHero } from '@/components/team/premium/TeamPremiumHero';
import { TeamPremiumSubNav } from '@/components/team/premium/TeamPremiumSubNav';
import { TeamRosterSection } from '@/components/team/premium/TeamRosterSection';
import { TeamDepthChartSection } from '@/components/team/premium/TeamDepthChartSection';
import { TeamRecruitingPipelineSection } from '@/components/team/premium/TeamRecruitingPipelineSection';
import { TeamDestinationGrid } from '@/components/team/TeamDestinationGrid';
import { buildPipelinePreview, computeHeroPulse } from '@/components/team/premium/team-premium-metrics';
import { TEAM_PREMIUM_TABS, type TeamPremiumTabId } from '@/components/team/premium/team-premium-types';

const SEED_BUNDLE: TeamHubBundle = buildSeedTeamHubBundle();

const SECTION_IDS = TEAM_PREMIUM_TABS.map((t) => t.id);
const DEFAULT_TAB: TeamPremiumTabId = 'depth-chart';

const HASH_DESTINATIONS: Record<string, string> = {
  'coaching-staff': '/vault/team/staff/',
  'team-identity': '/vault/team/identity/',
  'program-history': '/vault/team/history/',
};

function tabFromHash(): TeamPremiumTabId {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const hash = window.location.hash.replace('#', '') as TeamPremiumTabId;
  return SECTION_IDS.includes(hash) ? hash : DEFAULT_TAB;
}

export function TeamHubPage(): React.ReactElement {
  const cachedHub = typeof window !== 'undefined' ? readCachedTeamHubBundle() : null;
  const [bundle, setBundle] = useState<TeamHubBundle>(cachedHub ?? SEED_BUNDLE);
  const seedReady = (cachedHub ?? SEED_BUNDLE).roster.length > 0;
  const [loading, setLoading] = useState(!cachedHub && !seedReady);
  const [warming, setWarming] = useState(!cachedHub && !seedReady);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('All');
  const [dcTab, setDcTab] = useState<DepthChartTab>('offense');
  const [activeTab, setActiveTab] = useState<TeamPremiumTabId>(DEFAULT_TAB);
  const [pipelinePreview, setPipelinePreview] = useState(() => buildPipelinePreview(null, null));

  useVaultPageRestore('team', (saved) => {
    if (saved.rosterFilter && typeof saved.rosterFilter === 'string') {
      setRosterFilter(saved.rosterFilter as RosterFilter);
    }
  });

  const pipelineClassYear = primaryRecruitingClassYear();

  const load = useCallback(
    async (isInitial: boolean) => {
      const hadCache = isInitial && readCachedTeamHubBundle() != null;
      if (isInitial) {
        setPipelineLoading(true);
        if (!hadCache && SEED_BUNDLE.roster.length === 0) {
          setLoading(true);
          setWarming(true);
        }
      }
      try {
        const [hub, board, fcBoard] = await Promise.all([
          fetchTeamHubBundle({ onFresh: setBundle }),
          fetchRecruitingBoard(pipelineClassYear).catch(() => null),
          fetchFutureCastMasterBoard().catch(() => null),
        ]);
        setBundle(hub);
        setPipelinePreview(buildPipelinePreview(board, fcBoard));
      } finally {
        if (isInitial) {
          setLoading(false);
          setWarming(false);
        }
        setPipelineLoading(false);
      }
    },
    [pipelineClassYear]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    const persist = () =>
      saveVaultPageState('team', {
        scrollY: window.scrollY,
        rosterFilter,
      });
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, [rosterFilter]);

  const scrollToSection = useCallback((tab: TeamPremiumTabId) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
    const el = document.getElementById(tab);
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);

  useEffect(() => {
    const rawHash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (rawHash && HASH_DESTINATIONS[rawHash]) {
      window.location.replace(HASH_DESTINATIONS[rawHash]);
      return;
    }

    const initial = tabFromHash();
    setActiveTab(initial);
    if (initial !== DEFAULT_TAB) {
      requestAnimationFrame(() => scrollToSection(initial));
    }

    const onHash = () => {
      const next = window.location.hash.replace('#', '');
      if (HASH_DESTINATIONS[next]) {
        window.location.replace(HASH_DESTINATIONS[next]);
        return;
      }
      setActiveTab(tabFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [scrollToSection]);

  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveTab(visible[0].target.id as TeamPremiumTabId);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0.1, 0.25, 0.5] }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [loading]);

  const dcPositions =
    dcTab === 'offense'
      ? bundle.depthChart.offense
      : dcTab === 'defense'
        ? bundle.depthChart.defense
        : bundle.depthChart.specialTeams;

  const heroPulse = useMemo(() => computeHeroPulse(bundle), [bundle]);
  const hasDepthChart =
    bundle.depthChart.offense.length +
      bundle.depthChart.defense.length +
      bundle.depthChart.specialTeams.length >
    0;
  const rosterLoading = loading && bundle.roster.length === 0;
  const depthLoading = !hasDepthChart;
  const heroLoading = loading && !hasDepthChart && bundle.roster.length === 0;

  return (
    <TeamElitePageShell>
      <TeamPremiumHero pulse={heroPulse} loading={heroLoading} />
      <div className="team-premium-subnav-wrap rh-frame">
        <TeamPremiumSubNav active={activeTab} onSelect={scrollToSection} />
      </div>
      <div className="rh-frame rh-cc-page team-premium-cc-page">
        <TeamDepthChartSection
          dcTab={dcTab}
          onTabChange={setDcTab}
          positions={dcPositions}
          loading={depthLoading}
        />
        <TeamRosterSection
          roster={bundle.roster}
          filter={rosterFilter}
          onFilterChange={setRosterFilter}
          loading={rosterLoading}
          warming={warming}
        />
        <TeamRecruitingPipelineSection data={pipelinePreview} loading={pipelineLoading} />
        <TeamDestinationGrid />
      </div>
    </TeamElitePageShell>
  );
}
