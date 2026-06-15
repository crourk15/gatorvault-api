'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, type HeatCheckItem } from '@/lib/recruiting-api';
import { fetchStaffDashboard, type StaffDashboardPlayer, type StaffDashboardResponse } from '@/lib/staff-api';
import { fetchHighPriorityTargets, type HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { ScoutingDepartmentPage } from '@/components/site/ScoutingDepartmentPage';
import { DashboardMovementPreview } from '@/components/vault/dashboard/DashboardMovementPreview';
import { filterRecruitingHsOnly } from '@/lib/player-routes';
import { fromStaffDashboard, resolveCardVariant } from '@/lib/recruiting-card-adapters';
import {
  type RecruitingHubTab,
  recruitingTabPath,
  resolveRecruitingTab,
} from '@/lib/vault-route-map';
import { ensurePlayerSlug } from '@/lib/slug';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore, notifyVaultNavigation } from '@/lib/vault-navigation';
import { RecruitingHubHero, computeHubMomentum } from '@/components/vault/recruiting/RecruitingHubHero';
import { RecruitingTabBar, RecruitingSubTabBar } from '@/components/vault/recruiting/RecruitingTabBar';
import { PlayerCardEnhanced } from '@/components/vault/recruiting/EliteRecruitCard';
import { HeatCheckPanel } from '@/components/vault/recruiting/RecruitingHeatCheckPanel';
import { ScoutingTiles } from '@/components/vault/recruiting/RecruitingScoutingTiles';
import { PortalList } from '@/components/vault/recruiting/RecruitingPortalSection';
import { RankingsTable } from '@/components/vault/recruiting/RecruitingRankingsTable';
import { RecruitingHubFooter } from '@/components/vault/recruiting/RecruitingHubFooter';
import { isElitePlayer } from '@/lib/recruiting-hub-utils';

function rankCommits(list: RecruitingBoardPlayer[]): RecruitingBoardPlayer[] {
  return [...list].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    if (ra !== rb) return ra - rb;
    return (Number(b.stars) || 0) - (Number(a.stars) || 0);
  });
}

function rankTargets(list: RecruitingBoardPlayer[]): RecruitingBoardPlayer[] {
  return [...list].sort((a, b) => {
    const uf = (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0);
    if (uf !== 0) return uf;
    const na = a.natlRank ?? a.natl ?? 9999;
    const nb = b.natlRank ?? b.natl ?? 9999;
    if (na !== nb) return na - nb;
    return (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0);
  });
}

export function VaultRecruitingHubPage(): React.ReactElement {
  const [tab, setTab] = useState<RecruitingHubTab>('commits-2026');
  const [rankYear, setRankYear] = useState<2027 | 2028>(2027);
  const [b26, setB26] = useState<{ commits: RecruitingBoardPlayer[]; rankings: RecruitingBoardResponse['rankings'] }>({
    commits: [],
    rankings: null,
  });
  const [b27, setB27] = useState<{
    commits: RecruitingBoardPlayer[];
    targets: RecruitingBoardPlayer[];
    rankings: RecruitingBoardResponse['rankings'];
  }>({
    commits: [],
    targets: [],
    rankings: null,
  });
  const [b28, setB28] = useState<{ commits: RecruitingBoardPlayer[]; targets: RecruitingBoardPlayer[] }>({
    commits: [],
    targets: [],
  });
  const [rising, setRising] = useState<HeatCheckItem[]>([]);
  const [cooling, setCooling] = useState<HeatCheckItem[]>([]);
  const [staffDashboard, setStaffDashboard] = useState<StaffDashboardResponse | null>(null);
  const [intel, setIntel] = useState<{
    risers: StaffDashboardPlayer[];
    fallers: StaffDashboardPlayer[];
    volatile: StaffDashboardPlayer[];
  }>({ risers: [], fallers: [], volatile: [] });
  const [highPriority, setHighPriority] = useState<HighPriorityPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const restoreHubState = useCallback((saved: { tab?: string; rankYear?: number }) => {
    const tabs: RecruitingHubTab[] = [
      'priority', 'commits-2026', 'heat-check', 'commits-2027', 'targets-2027',
      'targets-2028', 'intel', 'scouting', 'portal', 'rankings',
    ];
    if (saved.tab && tabs.includes(saved.tab as RecruitingHubTab)) {
      setTab(saved.tab as RecruitingHubTab);
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
      setTab(next);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', recruitingTabPath(next, window.location.pathname));
        notifyVaultNavigation();
        saveVaultPageState('recruiting-hub', { tab: next, rankYear, scrollY: window.scrollY });
      }
    },
    [rankYear]
  );

  useEffect(() => {
    setTab(resolveRecruitingTab());
    const onNav = () => setTab(resolveRecruitingTab());
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
      const results = await Promise.allSettled([p26, p27, p28, pHeat, pStaff, pPriority]);
      const [r26, , r28, rHeat, rStaff, rPriority] = results;

      if (r26.status === 'fulfilled') {
        setB26({
          commits: rankCommits(filterRecruitingHsOnly(r26.value.commits ?? [])),
          rankings: r26.value.rankings ?? null,
        });
      }
      if (r28.status === 'fulfilled') {
        setB28({
          commits: rankCommits(filterRecruitingHsOnly(r28.value.commits ?? [])),
          targets: rankTargets(filterRecruitingHsOnly(r28.value.targets ?? [])),
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
    void load(true).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
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

  const nextTargets = useMemo(() => b27.targets.slice(0, 3), [b27.targets]);

  const playerPool = useMemo(
    () => [...b26.commits, ...b27.commits, ...b27.targets, ...b28.targets],
    [b26.commits, b27.commits, b27.targets, b28.targets]
  );

  const momentumPct = useMemo(
    () => computeHubMomentum(staffDashboard, b27.rankings?.classScore ?? null),
    [staffDashboard, b27.rankings?.classScore]
  );

  const enrichPlayer = (p: RecruitingBoardPlayer) => ({
    ...p,
    movementDirection:
      p.movementDirection ??
      (p.ufOvStatus === 'cancelled' ? ('down' as const) : p.ufOvStatus === 'scheduled' ? ('up' as const) : undefined),
    predictionSchools:
      p.predictionSchools ??
      (p.ufProbability
        ? [{ school: 'Florida', pct: Math.round(Number(p.ufProbability) * 100) }]
        : undefined),
  });

  const renderGrid = (
    players: RecruitingBoardPlayer[],
    variant: 'commit' | 'target' | 'ranking' | 'priority',
    emptyMsg: string
  ) => (
    <>
      <div className="gv-rh-elite-grid">
        {players.map((p) => (
          <PlayerCardEnhanced
            key={ensurePlayerSlug(p.slug, p.name)}
            player={enrichPlayer(p)}
            variant={resolveCardVariant(p, variant)}
            forceElite={isElitePlayer(enrichPlayer(p)) || variant === 'priority'}
          />
        ))}
      </div>
      {players.length === 0 && <UiEmpty message={emptyMsg} />}
    </>
  );

  const showContent = loadedOnce.current && !error;

  return (
    <div className="gv-rh-hub" data-testid="vault-recruiting-hub">
      <RecruitingHubHero
        momentumPct={momentumPct}
        staff={staffDashboard}
        nextTargets={nextTargets}
        commits={b27.commits}
        rankings={b27.rankings}
        compareRankings={b26.rankings ?? undefined}
        classYear={2027}
        priorClassYear={2026}
      />

      <RecruitingTabBar active={tab} onChange={setTabAndUrl} />

      <div className="gv-rh-content gv-rh-hub__frame">
        {loading && !loadedOnce.current && (
          <p className="gv-rh-status">Loading recruiting hub…</p>
        )}
        {refreshing && loadedOnce.current && (
          <p className="gv-rh-status gv-rh-status--inline">Refreshing…</p>
        )}
        {error && !loading && (
          <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Dashboard" />
        )}

        {showContent && tab === 'priority' && (
          <section>
            <h2 className="gv-rh-section-title">Top 10 UF Priority Targets</h2>
            <p className="gv-rh-section-sub">
              Insider intel, visit schedule, staff confidence, and prediction schools — the advantage board.
            </p>
            <div className="gv-hp-board-grid">
              {highPriority.map((p, i) => (
                <HighPriorityTargetCard key={p.slug} player={p} rank={i + 1} />
              ))}
            </div>
            {highPriority.length === 0 && <UiEmpty message="No priority targets loaded." />}
          </section>
        )}

        {showContent && tab === 'commits-2026' &&
          renderGrid(b26.commits, 'commit', 'No 2026 commits yet.')}

        {showContent && tab === 'heat-check' && (
          <HeatCheckPanel
            rising={rising}
            cooling={cooling}
            staff={staffDashboard}
            playerPool={playerPool}
          />
        )}

        {showContent && tab === 'commits-2027' &&
          renderGrid(b27.commits, 'commit', 'No 2027 commits yet.')}

        {showContent && tab === 'targets-2027' &&
          renderGrid(b27.targets, 'target', 'No 2027 targets.')}

        {showContent && tab === 'targets-2028' &&
          renderGrid(b28.targets, 'target', 'No 2028 targets yet — early discovery board coming soon.')}

        {showContent && tab === 'intel' && (
          <div className="gv-rh-movement-wrap">
            <DashboardMovementPreview data={staffDashboard} loading={!staffDashboard && loading} />
            {(intel.risers.length > 0 || intel.fallers.length > 0) && (
              <section style={{ marginTop: '2rem' }}>
                <h2 className="gv-rh-section-title">Movement Tracker</h2>
                <div className="gv-rh-elite-grid" style={{ marginTop: '1rem' }}>
                  {[...intel.risers.slice(0, 6), ...intel.fallers.slice(0, 4)].map((p) => (
                    <PlayerCardEnhanced key={p.id} player={fromStaffDashboard(p)} variant="target" forceElite />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {showContent && tab === 'scouting' && (
          <section>
            <ScoutingTiles />
            <ScoutingDepartmentPage inVault />
          </section>
        )}

        {showContent && tab === 'portal' && <PortalList />}

        {showContent && tab === 'rankings' && (
          <section>
            <RecruitingSubTabBar
              options={[
                { id: '2027', label: '2027' },
                { id: '2028', label: '2028' },
              ]}
              active={String(rankYear)}
              onChange={(id) => setRankYear(id === '2028' ? 2028 : 2027)}
            />
            <h2 className="gv-rh-section-title">Priority Rankings — {rankYear} Targets</h2>
            <RankingsTable players={rankings} year={rankYear} />
          </section>
        )}
      </div>

      <RecruitingHubFooter />
    </div>
  );
}
