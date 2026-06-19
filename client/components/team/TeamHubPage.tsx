'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTeamHubBundle, type TeamHubBundle } from '@/lib/team-hub-api';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import type { Coach, DepthChartTab, Era } from '@/lib/team-hub-types';
import type { RosterFilter } from '@/lib/team-hub-data';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { UiError } from '@/components/site/UiMessage';
import { CoachingStaffModal, EraDetailModal } from '@/components/team/CoachingStaffModal';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import { TeamPremiumHero } from '@/components/team/premium/TeamPremiumHero';
import { TeamPremiumSubNav } from '@/components/team/premium/TeamPremiumSubNav';
import { TeamOverviewSection } from '@/components/team/premium/TeamOverviewSection';
import { TeamRosterSection } from '@/components/team/premium/TeamRosterSection';
import { TeamDepthChartSection } from '@/components/team/premium/TeamDepthChartSection';
import { StaffCardGrid } from '@/components/team/premium/StaffCardGrid';
import { TeamIdentityPremiumSection } from '@/components/team/premium/TeamIdentityPremiumSection';
import { ProgramHistoryGrid } from '@/components/team/premium/ProgramHistoryGrid';
import { TeamRecruitingPipelineSection } from '@/components/team/premium/TeamRecruitingPipelineSection';
import {
  buildPipelinePreview,
  computeHeroMetrics,
} from '@/components/team/premium/team-premium-metrics';
import { TEAM_PREMIUM_TABS, type TeamPremiumTabId } from '@/components/team/premium/team-premium-types';

const EMPTY_BUNDLE: TeamHubBundle = {
  eras: [],
  achievements: [],
  identity: [],
  coaches: [],
  roster: [],
  depthChart: { offense: [], defense: [], specialTeams: [] },
  commandStats: {
    rosterCount: 0,
    startersLocked: 0,
    positionBattles: 0,
    updatedLabel: '—',
  },
  updatedAt: null,
};

const SECTION_IDS = TEAM_PREMIUM_TABS.map((t) => t.id);

function tabFromHash(): TeamPremiumTabId {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '') as TeamPremiumTabId;
  return SECTION_IDS.includes(hash) ? hash : 'overview';
}

export function TeamHubPage(): React.ReactElement {
  const [bundle, setBundle] = useState<TeamHubBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('All');
  const [dcTab, setDcTab] = useState<DepthChartTab>('offense');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);
  const [activeTab, setActiveTab] = useState<TeamPremiumTabId>('overview');
  const [pipelinePreview, setPipelinePreview] = useState(buildPipelinePreview(null));

  useVaultPageRestore('team', (saved) => {
    if (saved.rosterFilter && typeof saved.rosterFilter === 'string') {
      setRosterFilter(saved.rosterFilter as RosterFilter);
    }
  });

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const [hub, board] = await Promise.all([
        fetchTeamHubBundle(),
        fetchRecruitingBoard(2027).catch(() => null),
      ]);
      setBundle(hub);
      setPipelinePreview(buildPipelinePreview(board));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team hub.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    document.body.classList.toggle('gv-team-modal-open', Boolean(selectedCoach || selectedEra));
    return () => document.body.classList.remove('gv-team-modal-open');
  }, [selectedCoach, selectedEra]);

  const scrollToSection = useCallback((tab: TeamPremiumTabId) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
    const el = document.getElementById(tab);
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);

  useEffect(() => {
    const initial = tabFromHash();
    setActiveTab(initial);
    if (initial !== 'overview') {
      requestAnimationFrame(() => scrollToSection(initial));
    }

    const onHash = () => setActiveTab(tabFromHash());
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
  }, [loading, error]);

  const dcPositions =
    dcTab === 'offense'
      ? bundle.depthChart.offense
      : dcTab === 'defense'
        ? bundle.depthChart.defense
        : bundle.depthChart.specialTeams;

  const heroMetrics = useMemo(() => computeHeroMetrics(bundle), [bundle]);

  return (
    <TeamElitePageShell>
      {error && !loading ? (
        <div className="rh-frame team-cc-page">
          <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Home" />
        </div>
      ) : (
        <>
          <TeamPremiumHero metrics={heroMetrics} loading={loading && bundle.roster.length === 0} />
          <div className="team-premium-nav-wrap rh-frame">
            <TeamPremiumSubNav active={activeTab} onSelect={scrollToSection} />
          </div>
          <div className="rh-frame team-cc-page">
            <TeamOverviewSection bundle={bundle} pipelinePreview={pipelinePreview} />
            <TeamRosterSection
              roster={bundle.roster}
              filter={rosterFilter}
              onFilterChange={setRosterFilter}
              loading={loading && bundle.roster.length === 0}
            />
            <TeamDepthChartSection dcTab={dcTab} onTabChange={setDcTab} positions={dcPositions} />
            <StaffCardGrid coaches={bundle.coaches} onSelectCoach={setSelectedCoach} />
            <TeamIdentityPremiumSection />
            <ProgramHistoryGrid eras={bundle.eras} onSelectEra={setSelectedEra} />
            <TeamRecruitingPipelineSection />
          </div>
        </>
      )}

      <CoachingStaffModal coach={selectedCoach} onClose={() => setSelectedCoach(null)} />
      <EraDetailModal era={selectedEra} onClose={() => setSelectedEra(null)} />
    </TeamElitePageShell>
  );
}
