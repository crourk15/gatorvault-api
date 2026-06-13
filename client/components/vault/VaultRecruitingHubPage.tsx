'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, type HeatCheckItem } from '@/lib/recruiting-api';
import { fetchStaffDashboard, type StaffDashboardPlayer } from '@/lib/staff-api';
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
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';

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
  const [tab, setTab] = useState<RecruitingHubTab>(() => resolveRecruitingTab());
  const [intelSub, setIntelSub] = useState<IntelSubView>(() => {
    if (typeof window === 'undefined') return 'heat';
    return window.location.pathname.includes('heat-check') ? 'heat' : 'heat';
  });
  const [rankYear, setRankYear] = useState<2027 | 2028>(2027);
  const [b26, setB26] = useState<{ commits: RecruitingBoardPlayer[] }>({ commits: [] });
  const [b27, setB27] = useState<{ commits: RecruitingBoardPlayer[]; targets: RecruitingBoardPlayer[] }>({
    commits: [],
    targets: [],
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useVaultPageRestore('recruiting-hub', (saved) => {
    if (saved.tab && TAB_LABELS.some((t) => t.id === saved.tab)) setTab(saved.tab as RecruitingHubTab);
    if (saved.rankYear === 2027 || saved.rankYear === 2028) setRankYear(saved.rankYear);
  });

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
      saveVaultPageState('recruiting-hub', { tab: next, rankYear, scrollY: window.scrollY });
    }
  }, [rankYear]);

  useEffect(() => {
    setTab(resolveRecruitingTab());
    const onNav = () => setTab(resolveRecruitingTab());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d26, d27, d28, heat, staff] = await Promise.all([
        fetchRecruitingBoard(2026),
        fetchRecruitingBoard(2027),
        fetchRecruitingBoard(2028),
        fetchRecruitingHeatCheck(),
        fetchStaffDashboard().catch(() => null),
      ]);
      setB26({
        commits: rankCommits(filterRecruitingHsOnly(d26.commits ?? [])),
      });
      setB27({
        commits: rankCommits(filterRecruitingHsOnly(d27.commits ?? [])),
        targets: rankTargets(filterRecruitingHsOnly(d27.targets ?? [])),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting hub.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVaultDataReload(load);

  useEffect(() => {
    const onLeave = () => persistHubState();
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [persistHubState]);

  const highPriority = useMemo(() => {
    const headliners = b27.targets.filter((p) => p.headliner);
    const rest = b27.targets.filter((p) => !p.headliner);
    return rankTargets([...headliners, ...rest]).slice(0, 10);
  }, [b27.targets]);

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

      {loading && <p className="gv-page-status">Loading recruiting hub…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Dashboard" />
      )}

      {!loading && !error && tab === 'priority' && (
        <section className="gv-rh-priority">
          <h2 className="gv-vault-alerts__section-title">Top 10 UF Priority Targets</h2>
          <p className="gv-page-subtitle">
            Insider intel, visit schedule, staff confidence, and prediction schools — the advantage
            board.
          </p>
          {renderGrid(highPriority, 'priority', 'No priority targets loaded.')}
        </section>
      )}

      {!loading && !error && tab === 'commits-2026' &&
        renderGrid(b26.commits, 'commit', 'No 2026 commits yet.')}

      {!loading && !error && tab === 'heat-check' && (
        <HeatCheckPanel rising={rising} cooling={cooling} />
      )}

      {!loading && !error && tab === 'commits-2027' &&
        renderGrid(b27.commits, 'commit', 'No 2027 commits yet.')}

      {!loading && !error && tab === 'targets-2027' &&
        renderGrid(b27.targets, 'target', 'No 2027 targets.')}

      {!loading && !error && tab === 'targets-2028' &&
        renderGrid(b28.targets, 'target', 'No 2028 targets yet — early discovery board coming soon.')}

      {!loading && !error && tab === 'intel' && (
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

      {!loading && !error && tab === 'scouting' && (
        <div className="gv-rh-scouting">
          <ScoutingDepartmentPage inVault />
        </div>
      )}

      {!loading && !error && tab === 'portal' && (
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

      {!loading && !error && tab === 'rankings' && (
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
