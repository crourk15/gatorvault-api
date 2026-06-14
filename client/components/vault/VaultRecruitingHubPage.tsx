'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer, type RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, type HeatCheckItem } from '@/lib/recruiting-api';
import { fetchStaffDashboard, type StaffDashboardPlayer } from '@/lib/staff-api';
import { fetchHighPriorityTargets, type HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { ScoutingDepartmentPage } from '@/components/site/ScoutingDepartmentPage';
import {
  ClassicRecruitCard,
} from '@/components/vault/ClassicRecruitCard';
import { filterRecruitingHsOnly } from '@/lib/player-routes';
import { fromHeatCheck, fromStaffDashboard, resolveCardVariant } from '@/lib/recruiting-card-adapters';
import {
  type RecruitingHubTab,
  recruitingTabPath,
  resolveRecruitingTab,
} from '@/lib/vault-route-map';
import { ensurePlayerSlug } from '@/lib/slug';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore, notifyVaultNavigation } from '@/lib/vault-navigation';
import { ClassSummaryBar } from '@/components/vault/RecruitingBoardClassic';

/** Portal window closed until Dec transfer portal opens */
const PORTAL_SEASON_OPEN = false;

type IntelSubView = 'heat' | 'movement' | 'confidence';

const TAB_LABELS: { id: RecruitingHubTab; label: string }[] = [
  { id: 'priority', label: 'High Priority' },
  { id: 'commits-2026', label: '2026 Commits' },
  { id: 'heat-check', label: 'Heat Check' },
  { id: 'commits-2027', label: '2027 Commits' },
  { id: 'targets-2027', label: '2027 Targets' },
  { id: 'targets-2028', label: '2028 Targets' },
  { id: 'intel', label: 'Movement Intel' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'portal', label: 'Portal' },
  { id: 'rankings', label: 'Rankings' },
];

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

function HeatCheckPanel({
  rising,
  cooling,
}: {
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
}): React.ReactElement {
  return (
    <div className="gv-rh-intel-unified">
      <div className="gv-heat-columns">
        <div>
          <h2 className="gv-vault-alerts__section-title">🔥 Trending Up</h2>
          <div className="gv-rb-grid">
            {rising.map((item, i) => (
              <ClassicRecruitCard
                key={`${item.playerSlug ?? item.playerName}-${i}`}
                player={fromHeatCheck(item)}
                variant="target"
              />
            ))}
          </div>
          {rising.length === 0 && <UiEmpty message="No risers right now." />}
        </div>
        <div>
          <h2 className="gv-vault-alerts__section-title">🟥 Trending Down</h2>
          <div className="gv-rb-grid">
            {cooling.map((item, i) => (
              <ClassicRecruitCard
                key={`${item.playerSlug ?? item.playerName}-${i}`}
                player={fromHeatCheck(item)}
                variant="target"
              />
            ))}
          </div>
          {cooling.length === 0 && <UiEmpty message="No cooling signals." />}
        </div>
      </div>
    </div>
  );
}

function MovementIntelPanel({
  intelSub,
  setIntelSub,
  rising,
  cooling,
  risers,
  fallers,
  volatile,
}: {
  intelSub: IntelSubView;
  setIntelSub: (v: IntelSubView) => void;
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  risers: StaffDashboardPlayer[];
  fallers: StaffDashboardPlayer[];
  volatile: StaffDashboardPlayer[];
}): React.ReactElement {
  return (
    <div className="gv-rh-intel-unified">
      <div className="gv-hub-tabs gv-hub-tabs--sub">
        <button
          type="button"
          className={`gv-hub-tab${intelSub === 'heat' ? ' is-active' : ''}`}
          onClick={() => setIntelSub('heat')}
        >
          Heat Check
        </button>
        <button
          type="button"
          className={`gv-hub-tab${intelSub === 'movement' ? ' is-active' : ''}`}
          onClick={() => setIntelSub('movement')}
        >
          Movement Tracker
        </button>
        <button
          type="button"
          className={`gv-hub-tab${intelSub === 'confidence' ? ' is-active' : ''}`}
          onClick={() => setIntelSub('confidence')}
        >
          Staff Confidence
        </button>
      </div>

      {intelSub === 'heat' && <HeatCheckPanel rising={rising} cooling={cooling} />}

      {intelSub === 'movement' && (
        <div className="gv-heat-columns">
          <div>
            <h3 className="gv-vault-alerts__section-title">▲ Top Risers</h3>
            <div className="gv-rb-grid">
              {risers.slice(0, 10).map((p) => (
                <ClassicRecruitCard key={p.id} player={fromStaffDashboard(p)} variant="target" />
              ))}
            </div>
            {risers.length === 0 && <p className="gv-rh-intel__empty">No risers this window.</p>}
          </div>
          <div>
            <h3 className="gv-vault-alerts__section-title">▼ Top Fallers</h3>
            <div className="gv-rb-grid">
              {fallers.slice(0, 10).map((p) => (
                <ClassicRecruitCard key={p.id} player={fromStaffDashboard(p)} variant="target" />
              ))}
            </div>
          </div>
          <div>
            <h3 className="gv-vault-alerts__section-title">🟨 High Volatility</h3>
            <div className="gv-rb-grid">
              {volatile.slice(0, 10).map((p) => (
                <ClassicRecruitCard key={p.id} player={fromStaffDashboard(p)} variant="target" />
              ))}
            </div>
          </div>
        </div>
      )}

      {intelSub === 'confidence' && (
        <div className="gv-rh-staff-meter">
          <p className="gv-page-subtitle">
            Staff confidence meter — high-tier targets with grades appear in Scouting. Movement
            signals feed FutureCast.
          </p>
          <p className="gv-rh-intel__link">
            <a href="/vault/futurecast/movement">Open full Movement Intel dashboard →</a>
          </p>
        </div>
      )}
    </div>
  );
}

export function VaultRecruitingHubPage(): React.ReactElement {
  const [tab, setTab] = useState<RecruitingHubTab>('commits-2026');
  const [intelSub, setIntelSub] = useState<IntelSubView>('heat');
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
    if (saved.tab && TAB_LABELS.some((t) => t.id === saved.tab)) setTab(saved.tab as RecruitingHubTab);
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

  const setTabAndUrl = useCallback((next: RecruitingHubTab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', recruitingTabPath(next));
      notifyVaultNavigation();
      saveVaultPageState('recruiting-hub', { tab: next, rankYear, scrollY: window.scrollY });
    }
  }, [rankYear]);

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
    try {
      const [d26, d27, d28, heat, staff, priority] = await Promise.all([
        fetchRecruitingBoard(2026),
        fetchRecruitingBoard(2027),
        fetchRecruitingBoard(2028),
        fetchRecruitingHeatCheck(isInitial),
        fetchStaffDashboard().catch(() => null),
        fetchHighPriorityTargets().catch(() => ({
          classYear: 2027,
          count: 0,
          updatedAt: '',
          players: [] as HighPriorityPlayer[],
        })),
      ]);
      setB26({
        commits: rankCommits(filterRecruitingHsOnly(d26.commits ?? [])),
        rankings: d26.rankings ?? null,
      });
      setB27({
        commits: rankCommits(filterRecruitingHsOnly(d27.commits ?? [])),
        targets: rankTargets(filterRecruitingHsOnly(d27.targets ?? [])),
        rankings: d27.rankings ?? null,
      });
      setB28({
        commits: rankCommits(filterRecruitingHsOnly(d28.commits ?? [])),
        targets: rankTargets(filterRecruitingHsOnly(d28.targets ?? [])),
      });
      setRising(heat.rising ?? []);
      setCooling(heat.cooling ?? []);
      if (staff) {
        setIntel({
          risers: staff.topRisers ?? [],
          fallers: staff.topFallers ?? [],
          volatile: staff.highVolatility ?? [],
        });
      }
      setHighPriority(priority.players ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting hub.');
    } finally {
      if (isInitial) {
        setLoading(false);
        loadedOnce.current = true;
      } else {
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

  const renderGrid = (
    players: RecruitingBoardPlayer[],
    variant: 'commit' | 'target' | 'ranking' | 'priority',
    emptyMsg: string
  ) => (
    <>
      <div className="gv-rb-grid">
        {players.map((p) => (
          <ClassicRecruitCard
            key={ensurePlayerSlug(p.slug, p.name)}
            player={{
              ...p,
              movementDirection:
                p.movementDirection ??
                (p.ufOvStatus === 'cancelled' ? 'down' : p.ufOvStatus === 'scheduled' ? 'up' : undefined),
              predictionSchools:
                p.predictionSchools ??
                (p.ufProbability
                  ? [{ school: 'Florida', pct: Math.round(Number(p.ufProbability) * 100) }]
                  : undefined),
            }}
            variant={resolveCardVariant(p, variant)}
          />
        ))}
      </div>
      {players.length === 0 && <UiEmpty message={emptyMsg} />}
    </>
  );

  return (
    <div className="gv-recruiting-hub gv-rh" data-testid="vault-recruiting-hub">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Hub</h1>
        <p className="gv-page-subtitle">
          Elite UF recruiting intel — commits, targets, movement, and scouting.{' '}
          <a href="/vault/recruiting/board">Recruiting Board →</a> ·{' '}
          <a href="/vault/futurecast">FutureCast →</a> · <a href="/vault/team">Team →</a>
        </p>
      </div>

      <div className="gv-hub-tabs gv-hub-tabs--scroll">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`gv-hub-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTabAndUrl(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !loadedOnce.current && <p className="gv-page-status">Loading recruiting hub…</p>}
      {refreshing && loadedOnce.current && (
        <p className="gv-page-status gv-page-status--inline">Refreshing…</p>
      )}
      {error && !loading && (
        <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Dashboard" />
      )}

      {loadedOnce.current && !error && (
        <ClassSummaryBar
          commits={b27.commits}
          rankings={b27.rankings}
          classYear={2027}
          compareRankings={b26.rankings ?? undefined}
        />
      )}

      {loadedOnce.current && !error && tab === 'priority' && (
        <section className="gv-rh-priority">
          <h2 className="gv-vault-alerts__section-title">Top 10 UF Priority Targets</h2>
          <p className="gv-page-subtitle">
            Insider intel, visit schedule, staff confidence, and prediction schools — the advantage
            board.
          </p>
          <div className="gv-hp-board-grid">
            {highPriority.map((p, i) => (
              <HighPriorityTargetCard key={p.slug} player={p} rank={i + 1} />
            ))}
          </div>
          {highPriority.length === 0 && <UiEmpty message="No priority targets loaded." />}
        </section>
      )}

      {loadedOnce.current && !error && tab === 'commits-2026' &&
        renderGrid(b26.commits, 'commit', 'No 2026 commits yet.')}

      {loadedOnce.current && !error && tab === 'heat-check' && (
        <HeatCheckPanel rising={rising} cooling={cooling} />
      )}

      {loadedOnce.current && !error && tab === 'commits-2027' &&
        renderGrid(b27.commits, 'commit', 'No 2027 commits yet.')}

      {loadedOnce.current && !error && tab === 'targets-2027' &&
        renderGrid(b27.targets, 'target', 'No 2027 targets.')}

      {loadedOnce.current && !error && tab === 'targets-2028' &&
        renderGrid(b28.targets, 'target', 'No 2028 targets yet — early discovery board coming soon.')}

      {loadedOnce.current && !error && tab === 'intel' && (
        <MovementIntelPanel
          intelSub={intelSub}
          setIntelSub={setIntelSub}
          rising={rising}
          cooling={cooling}
          risers={intel.risers}
          fallers={intel.fallers}
          volatile={intel.volatile}
        />
      )}

      {loadedOnce.current && !error && tab === 'scouting' && (
        <div className="gv-rh-scouting">
          <ScoutingDepartmentPage inVault />
        </div>
      )}

      {loadedOnce.current && !error && tab === 'portal' && (
        <div className="gv-rh-portal">
          {!PORTAL_SEASON_OPEN ? (
            <div className="gv-rh-portal-closed">
              <span className="gv-rh-portal-closed__icon">🔒</span>
              <h2 className="gv-vault-alerts__section-title">Portal Closed</h2>
              <p className="gv-page-subtitle">
                No active portal entries. When the transfer portal opens, this tab will show
                incoming targets, portal commits, fit scores, eligibility remaining, and staff
                confidence.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {loadedOnce.current && !error && tab === 'rankings' && (
        <div className="gv-rh-rankings">
          <div className="gv-hub-tabs gv-hub-tabs--sub">
            <button
              type="button"
              className={`gv-hub-tab${rankYear === 2027 ? ' is-active' : ''}`}
              onClick={() => setRankYear(2027)}
            >
              2027
            </button>
            <button
              type="button"
              className={`gv-hub-tab${rankYear === 2028 ? ' is-active' : ''}`}
              onClick={() => setRankYear(2028)}
            >
              2028
            </button>
          </div>
          <h2 className="gv-vault-alerts__section-title">Priority Rankings — {rankYear} Targets</h2>
          {renderGrid(rankings.slice(0, 50), 'ranking', `No ${rankYear} ranked targets.`)}
        </div>
      )}
    </div>
  );
}
