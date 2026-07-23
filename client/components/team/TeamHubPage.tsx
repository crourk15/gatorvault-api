'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSeedTeamHubBundle,
  fetchTeamHubBundle,
  readCachedTeamHubBundle,
  type TeamHubBundle,
} from '@/lib/team-hub-api';
import { fetchRecruitingBoard, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
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
import { buildPipelinePreview, computeHeroMetrics } from '@/components/team/premium/team-premium-metrics';
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

function boardHasPlayers(board: RecruitingBoardResponse | null): boolean {
  if (!board) return false;
  const commits = board.commits?.length ?? 0;
  const targets = board.targets?.length ?? 0;
  const players = board.players?.length ?? 0;
  return commits + targets + players > 0;
}

export function TeamHubPage(): React.ReactElement {
  const cachedHub = typeof window !== 'undefined' ? readCachedTeamHubBundle() : null;
  const [bundle, setBundle] = useState<TeamHubBundle>(cachedHub ?? SEED_BUNDLE);
  const seedReady = (cachedHub ?? SEED_BUNDLE).roster.length > 0;
  const [loading, setLoading] = useState(!cachedHub && !seedReady);
  const [warming, setWarming] = useState(!cachedHub && !seedReady);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('QB');
  const [dcTab, setDcTab] = useState<DepthChartTab>('offense');
  const [activeTab, setActiveTab] = useState<TeamPremiumTabId>(DEFAULT_TAB);
  const [pipelinePreview, setPipelinePreview] = useState(() => buildPipelinePreview(null, null));

  const pendingPlayerRestoreRef = useRef(false);

  const shouldRestoreScrollRef = useRef(false);

  useVaultPageRestore(
    'team',
    (saved) => {
      if (saved.rosterFilter && typeof saved.rosterFilter === 'string') {
        const raw = saved.rosterFilter as string;
        // Legacy DB bucket → CB room
        const next = (raw === 'DB' ? 'CB' : raw) as RosterFilter;
        setRosterFilter(next);
      }
      shouldRestoreScrollRef.current = Boolean(saved.restoreScroll && saved.scrollY != null);
    },
    { requireRestoreScrollFlag: true }
  );

  // Bottom-nav / fresh Team entry must stay on the hero. Re-assert top after
  // layout settles (roster chips used to scrollIntoView the page to mid-roster).
  useEffect(() => {
    if (shouldRestoreScrollRef.current) return;
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    toTop();
    const t1 = window.setTimeout(toTop, 50);
    const t2 = window.setTimeout(toTop, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading]);

  const pipelineClassYear = primaryRecruitingClassYear();

  const loadHub = useCallback(async (isInitial: boolean) => {
    const hadCache = isInitial && readCachedTeamHubBundle() != null;
    if (isInitial && !hadCache && SEED_BUNDLE.roster.length === 0) {
      setLoading(true);
      setWarming(true);
    }
    try {
      const hub = await fetchTeamHubBundle({ onFresh: setBundle });
      setBundle(hub);
    } finally {
      if (isInitial) {
        setLoading(false);
        setWarming(false);
      }
    }
  }, []);

  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      let board = await fetchRecruitingBoard(pipelineClassYear).catch(() => null);
      if (!boardHasPlayers(board)) {
        const altYear = pipelineClassYear === 2028 ? 2027 : 2028;
        const alt = await fetchRecruitingBoard(altYear).catch(() => null);
        if (boardHasPlayers(alt)) board = alt;
      }
      const fcBoard = await fetchFutureCastMasterBoard().catch(() => null);
      setPipelinePreview(buildPipelinePreview(board, fcBoard));
    } finally {
      setPipelineLoading(false);
    }
  }, [pipelineClassYear]);

  useEffect(() => {
    void loadHub(true);
  }, [loadHub]);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  useVaultDataReload(() => {
    void loadHub(false);
    void loadPipeline();
  });

  // Save scroll only when leaving into a player profile. Bottom-nav / fresh
  // Team entry should start at the hero, not mid-page near Roster.
  useEffect(() => {
    const onPlayerNav = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!/\/players?\/|\/player\//.test(href)) return;
      pendingPlayerRestoreRef.current = true;
      saveVaultPageState('team', {
        rosterFilter,
        scrollY: window.scrollY,
        restoreScroll: true,
      });
    };
    document.addEventListener('click', onPlayerNav, true);
    return () => document.removeEventListener('click', onPlayerNav, true);
  }, [rosterFilter]);

  useEffect(() => {
    const persist = () => {
      if (pendingPlayerRestoreRef.current) {
        saveVaultPageState('team', {
          rosterFilter,
          scrollY: window.scrollY,
          restoreScroll: true,
        });
        return;
      }
      saveVaultPageState('team', { rosterFilter });
    };
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

  const heroMetrics = useMemo(() => computeHeroMetrics(bundle).slice(0, 3), [bundle]);
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
      <TeamPremiumHero metrics={heroMetrics} loading={heroLoading} />
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
