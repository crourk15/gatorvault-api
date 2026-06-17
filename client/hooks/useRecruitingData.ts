'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, fetchRecruitingPortalBoard, fetchAllRecruitingPlayers, type HeatCheckItem } from '@/lib/recruiting-api';
import {
  buildPortalBuckets,
  type PortalBuckets,
} from '@/components/recruiting-hub/utils/portalData';
import { fetchStaffDashboard, type StaffDashboardPlayer, type StaffDashboardResponse } from '@/lib/staff-api';
import { fetchHighPriorityTargets, type HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { filterRecruitingHsOnly } from '@/lib/player-routes';
import {
  type RecruitingHubTab,
  normalizeRecruitingTab,
  recruitingTabPath,
  resolveRecruitingTab,
} from '@/lib/vault-route-map';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore, notifyVaultNavigation } from '@/lib/vault-navigation';
import {
  filterCommitsWithoutHeadliner,
  gridConfigForTab,
  pickHeadliner,
  rankCommits,
  rankTargets,
} from '@/components/recruiting-hub/utils/gridConfig';

type ClassBundle = {
  commits: RecruitingBoardPlayer[];
  targets: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

const EMPTY_BUNDLE: ClassBundle = { commits: [], targets: [], rankings: null };
const EMPTY_PORTAL: PortalBuckets = { incoming: [], targets: [], outgoing: [] };
const RECRUITING_POLL_MS = 90_000;

export function useRecruitingData() {
  const [tab, setTab] = useState<RecruitingHubTab>('commits-2027');
  const [rankYear, setRankYear] = useState<2027 | 2028>(2027);
  const [b26, setB26] = useState<ClassBundle>(EMPTY_BUNDLE);
  const [b27, setB27] = useState<ClassBundle>(EMPTY_BUNDLE);
  const [b28, setB28] = useState<ClassBundle>(EMPTY_BUNDLE);
  const [rising, setRising] = useState<HeatCheckItem[]>([]);
  const [cooling, setCooling] = useState<HeatCheckItem[]>([]);
  const [staffDashboard, setStaffDashboard] = useState<StaffDashboardResponse | null>(null);
  const [intel, setIntel] = useState<{
    risers: StaffDashboardPlayer[];
    fallers: StaffDashboardPlayer[];
    volatile: StaffDashboardPlayer[];
  }>({ risers: [], fallers: [], volatile: [] });
  const [highPriority, setHighPriority] = useState<HighPriorityPlayer[]>([]);
  const [portal, setPortal] = useState<PortalBuckets>(EMPTY_PORTAL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const restoreHubState = useCallback((saved: { tab?: string; rankYear?: number }) => {
    const tabs: RecruitingHubTab[] = [
      'priority', 'commits-2026', 'commits-2027', 'targets-2027',
      'targets-2028', 'intel', 'scouting', 'portal', 'rankings',
    ];
    if (saved.tab && tabs.includes(saved.tab as RecruitingHubTab)) {
      setTab(normalizeRecruitingTab(saved.tab as RecruitingHubTab));
    }
    if (saved.rankYear === 2027 || saved.rankYear === 2028) setRankYear(saved.rankYear);
  }, []);

  useVaultPageRestore('recruiting-hub', restoreHubState);

  const persistHubState = useCallback(() => {
    saveVaultPageState('recruiting-hub', {
      tab,
      rankYear,
      scrollY: window.scrollY,
    });
  }, [tab, rankYear]);

  const setTabAndUrl = useCallback(
    (next: RecruitingHubTab) => {
      const canonical = normalizeRecruitingTab(next);
      setTab(canonical);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', recruitingTabPath(canonical, window.location.pathname));
        notifyVaultNavigation();
        saveVaultPageState('recruiting-hub', { tab: canonical, rankYear, scrollY: window.scrollY });
      }
    },
    [rankYear]
  );

  useEffect(() => {
    setTab(normalizeRecruitingTab(resolveRecruitingTab()));
    const onNav = () => setTab(normalizeRecruitingTab(resolveRecruitingTab()));
    window.addEventListener('popstate', onNav);
    window.addEventListener('vault:navigation', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('vault:navigation', onNav);
    };
  }, []);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    if (isInitial) setError(null);

    const p26 = fetchRecruitingBoard(2026);
    const p27 = fetchRecruitingBoard(2027);
    const p28 = fetchRecruitingBoard(2028);
    const pHeat = fetchRecruitingHeatCheck(!isInitial);
    const pStaff = fetchStaffDashboard();
    const pPriority = fetchHighPriorityTargets();
    const pPortal = fetchRecruitingPortalBoard();
    const pAllPlayers = fetchAllRecruitingPlayers();

    void p27
      .then((d27) => {
        setB27({
          commits: rankCommits(filterRecruitingHsOnly(d27.commits ?? [])),
          targets: rankTargets(filterRecruitingHsOnly(d27.targets ?? [])),
          rankings: d27.rankings ?? null,
        });
        if (isInitial) {
          setLoading(false);
          loadedOnce.current = true;
        }
      })
      .catch(() => {
        if (isInitial) {
          setLoading(false);
          loadedOnce.current = true;
        }
      });

    try {
      const results = await Promise.allSettled([p26, p27, p28, pHeat, pStaff, pPriority, pPortal, pAllPlayers]);
      const [r26, , r28, rHeat, rStaff, rPriority, rPortal, rAllPlayers] = results;

      if (r26.status === 'fulfilled') {
        setB26({
          commits: rankCommits(filterRecruitingHsOnly(r26.value.commits ?? [])),
          targets: rankTargets(filterRecruitingHsOnly(r26.value.targets ?? [])),
          rankings: r26.value.rankings ?? null,
        });
      }
      if (r28.status === 'fulfilled') {
        setB28({
          commits: rankCommits(filterRecruitingHsOnly(r28.value.commits ?? [])),
          targets: rankTargets(filterRecruitingHsOnly(r28.value.targets ?? [])),
          rankings: r28.value.rankings ?? null,
        });
      }
      if (rHeat.status === 'fulfilled') {
        setRising(rHeat.value.rising ?? []);
        setCooling(rHeat.value.cooling ?? []);
      }
      if (rStaff.status === 'fulfilled') {
        setStaffDashboard(rStaff.value);
        setIntel({
          risers: rStaff.value.topRisers ?? [],
          fallers: rStaff.value.topFallers ?? [],
          volatile: rStaff.value.highVolatility ?? [],
        });
      }
      if (rPriority.status === 'fulfilled') {
        setHighPriority(rPriority.value.players ?? []);
      }
      if (rPortal.status === 'fulfilled' || rAllPlayers.status === 'fulfilled') {
        const incoming = rPortal.status === 'fulfilled' ? rPortal.value : [];
        const allPlayers = rAllPlayers.status === 'fulfilled' ? rAllPlayers.value : [];
        setPortal(buildPortalBuckets(incoming, allPlayers));
      }

      const anySuccess = results.some((r) => r.status === 'fulfilled');
      if (!anySuccess && isInitial) {
        const firstErr = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setError(
          firstErr?.reason instanceof Error
            ? firstErr.reason.message
            : 'Could not load recruiting hub.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting hub.');
    } finally {
      if (isInitial && !loadedOnce.current) {
        setLoading(false);
        loadedOnce.current = true;
      } else if (!isInitial) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true).then(() => {
      if (cancelled) return;
    });
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, RECRUITING_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    const onLeave = () => persistHubState();
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [persistHubState]);

  const rankings = useMemo(() => {
    const pool = rankYear === 2027 ? b27.targets : b28.targets;
    return rankTargets(pool);
  }, [b27.targets, b28.targets, rankYear]);

  const headliner = useMemo(() => pickHeadliner(b27.commits), [b27.commits]);
  const commitsWithoutHeadliner = useMemo(
    () => filterCommitsWithoutHeadliner(b27.commits, headliner),
    [b27.commits, headliner]
  );

  const gridConfig = useMemo(
    () => gridConfigForTab(tab, b26, b27, b28, commitsWithoutHeadliner),
    [tab, b26, b27, b28, commitsWithoutHeadliner]
  );

  return {
    tab,
    setTabAndUrl,
    rankYear,
    setRankYear,
    b26,
    b27,
    b28,
    class2026: b26,
    class2027: b27,
    class2028: b28,
    portal,
    rising,
    cooling,
    staffDashboard,
    intel,
    highPriority,
    loading,
    refreshing,
    error,
    loadedOnce: loadedOnce.current,
    reload: () => void load(true),
    rankings,
    headliner,
    gridConfig,
  };
}
