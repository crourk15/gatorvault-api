'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, fetchPortalIncoming, type HeatCheckItem } from '@/lib/recruiting-api';
import { fetchStaffDashboard, type StaffDashboardPlayer } from '@/lib/staff-api';
import { ScoutingDepartmentPage } from '@/components/site/ScoutingDepartmentPage';
import { PortalWatchlistGrid } from '@/components/futurecast/PortalWatchlistGrid';
import {
  filterRecruitingHsOnly,
  playerProfilePath,
  recruitingProfileLifecycle,
} from '@/lib/player-routes';
import { ensurePlayerSlug } from '@/lib/slug';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const ACE_PORTAL_SLUG = 'eric-singleton-jr';

export type RecruitingHubTab =
  | 'commits-2026'
  | 'commits-2027'
  | 'targets-2026'
  | 'targets-2027'
  | 'heat'
  | 'scouting'
  | 'portal'
  | 'intel'
  | 'rankings';

const TAB_LABELS: { id: RecruitingHubTab; label: string }[] = [
  { id: 'commits-2026', label: '2026 Commits' },
  { id: 'commits-2027', label: '2027 Commits' },
  { id: 'targets-2026', label: '2026 Targets' },
  { id: 'targets-2027', label: '2027 Targets' },
  { id: 'heat', label: 'Heat Check' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'portal', label: 'Portal' },
  { id: 'intel', label: 'Movement Intel' },
  { id: 'rankings', label: 'Rankings' },
];

function parseHubTab(): RecruitingHubTab {
  if (typeof window === 'undefined') return 'commits-2026';
  const t = new URLSearchParams(window.location.search).get('tab') as RecruitingHubTab | null;
  if (t && TAB_LABELS.some((x) => x.id === t)) return t;
  return 'commits-2026';
}

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
    return (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0);
  });
}

function CommitCard({
  player,
  rank,
}: {
  player: RecruitingBoardPlayer;
  rank: number;
}): React.ReactElement {
  const slug = ensurePlayerSlug(player.slug, player.name);
  const lifecycle = recruitingProfileLifecycle(player);
  const href = playerProfilePath(slug, lifecycle, true, player.name);

  return (
    <a href={href} className="gv-rh-card gv-rh-card--commit">
      <div className="gv-rh-card__rank">#{rank}</div>
      <div className="gv-rh-card__body">
        <h3 className="gv-rh-card__name">{player.name}</h3>
        <p className="gv-rh-card__meta">
          {player.position || player.pos} · {player.school || '—'} · {player.classYear}
          {player.stars ? ` · ${player.stars}★` : ''}
        </p>
        <div className="gv-rh-card__tags">
          <span className="gv-rh-card__status">{player.status || 'Committed'}</span>
          {player.staffGrade && <span className="gv-rh-card__grade">Grade {player.staffGrade}</span>}
          {player.ufProbability != null && (
            <span className="gv-rh-card__prob">UF {Math.round(Number(player.ufProbability) * 100)}%</span>
          )}
        </div>
        {(player.notes || player.notePreview) && (
          <p className="gv-rh-card__note">{player.notes || player.notePreview}</p>
        )}
      </div>
    </a>
  );
}

function TargetCard({
  player,
  rank,
}: {
  player: RecruitingBoardPlayer;
  rank: number;
}): React.ReactElement {
  const slug = ensurePlayerSlug(player.slug, player.name);
  const href = playerProfilePath(slug, 'HIGH_SCHOOL', true, player.name);

  return (
    <a href={href} className="gv-rh-card gv-rh-card--target">
      <div className="gv-rh-card__rank">{rank}</div>
      <div className="gv-rh-card__body">
        <h3 className="gv-rh-card__name">{player.name}</h3>
        <p className="gv-rh-card__meta">
          {player.position || player.pos} · {player.state || '—'} · {player.tierLabel || player.tier}
        </p>
        <div className="gv-rh-card__tags">
          {player.ufProbability != null && (
            <span className="gv-rh-card__prob">UF {Math.round(Number(player.ufProbability) * 100)}%</span>
          )}
          {player.fitScore != null && (
            <span className="gv-rh-card__grade">Fit {Number(player.fitScore).toFixed(2)}</span>
          )}
        </div>
      </div>
    </a>
  );
}

function HeatCard({ item, direction }: { item: HeatCheckItem; direction: 'up' | 'down' }): React.ReactElement {
  const slug = item.playerSlug ? ensurePlayerSlug(item.playerSlug, item.playerName) : '';
  const inner = (
    <>
      <h3 className="gv-heat-card__name">{item.playerName}</h3>
      <p className="gv-heat-card__label">{item.triggerLabel || direction}</p>
      {item.headline && <p className="gv-heat-card__why">{item.headline}</p>}
      {item.predictionSchool && <p className="gv-heat-card__school">{item.predictionSchool}</p>}
    </>
  );
  if (slug) {
    return (
      <a href={playerProfilePath(slug, 'HIGH_SCHOOL', true, item.playerName)} className={`gv-heat-card gv-heat-card--${direction === 'up' ? 'rising' : 'cooling'}`}>
        {inner}
      </a>
    );
  }
  return <article className={`gv-heat-card gv-heat-card--${direction === 'up' ? 'rising' : 'cooling'}`}>{inner}</article>;
}

function IntelSummary({
  risers,
  fallers,
  volatile,
}: {
  risers: StaffDashboardPlayer[];
  fallers: StaffDashboardPlayer[];
  volatile: StaffDashboardPlayer[];
}): React.ReactElement {
  return (
    <div className="gv-rh-intel">
      <p className="gv-rh-intel__link">
        <a href="/vault/futurecast/staff">Open full Movement Intel dashboard →</a>
      </p>
      <div className="gv-rh-intel__cols">
        <div>
          <h3 className="gv-vault-alerts__section-title">Top Risers</h3>
          <ul className="gv-rh-intel__list">
            {risers.slice(0, 5).map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name)}>
                  {p.name} {p.delta != null ? `(+${p.delta}%)` : ''}
                </a>
              </li>
            ))}
            {risers.length === 0 && <li className="gv-rh-intel__empty">No risers this window.</li>}
          </ul>
        </div>
        <div>
          <h3 className="gv-vault-alerts__section-title">Top Fallers</h3>
          <ul className="gv-rh-intel__list">
            {fallers.slice(0, 5).map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name)}>
                  {p.name} {p.delta != null ? `(${p.delta}%)` : ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="gv-vault-alerts__section-title">High Volatility</h3>
          <ul className="gv-rh-intel__list">
            {volatile.slice(0, 5).map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name)}>
                  {p.name} · {p.volatilityScore ?? '—'}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function VaultRecruitingHubPage(): React.ReactElement {
  const [tab, setTab] = useState<RecruitingHubTab>(parseHubTab);
  const [b26, setB26] = useState<{ commits: RecruitingBoardPlayer[]; targets: RecruitingBoardPlayer[] }>({
    commits: [],
    targets: [],
  });
  const [b27, setB27] = useState<{ commits: RecruitingBoardPlayer[]; targets: RecruitingBoardPlayer[] }>({
    commits: [],
    targets: [],
  });
  const [rising, setRising] = useState<HeatCheckItem[]>([]);
  const [cooling, setCooling] = useState<HeatCheckItem[]>([]);
  const [portal, setPortal] = useState<Awaited<ReturnType<typeof fetchPortalIncoming>>>([]);
  const [intel, setIntel] = useState<{
    risers: StaffDashboardPlayer[];
    fallers: StaffDashboardPlayer[];
    volatile: StaffDashboardPlayer[];
  }>({ risers: [], fallers: [], volatile: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setTabAndUrl = useCallback((next: RecruitingHubTab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d26, d27, heat, incoming, staff] = await Promise.all([
        fetchRecruitingBoard(2026),
        fetchRecruitingBoard(2027),
        fetchRecruitingHeatCheck(),
        fetchPortalIncoming(48),
        fetchStaffDashboard().catch(() => null),
      ]);
      setB26({
        commits: rankCommits(filterRecruitingHsOnly(d26.commits ?? [])),
        targets: rankTargets(filterRecruitingHsOnly(d26.targets ?? [])),
      });
      setB27({
        commits: rankCommits(filterRecruitingHsOnly(d27.commits ?? [])),
        targets: rankTargets(filterRecruitingHsOnly(d27.targets ?? [])),
      });
      setRising(heat.rising ?? []);
      setCooling(heat.cooling ?? []);
      setPortal(incoming);
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

  const rankings = useMemo(() => {
    return [...b27.targets, ...b26.targets].sort(
      (a, b) => (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0)
    );
  }, [b26.targets, b27.targets]);

  return (
    <div className="gv-recruiting-hub gv-rh" data-testid="vault-recruiting-hub">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Hub</h1>
        <p className="gv-page-subtitle">
          Commits, targets, portal, scouting, and movement intel in one place.{' '}
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

      {!loading && !error && tab === 'commits-2026' && (
        <div className="gv-rh-grid">
          {b26.commits.map((p, i) => (
            <CommitCard key={ensurePlayerSlug(p.slug, p.name)} player={p} rank={i + 1} />
          ))}
          {b26.commits.length === 0 && <UiEmpty message="No 2026 commits yet." />}
        </div>
      )}

      {!loading && !error && tab === 'commits-2027' && (
        <div className="gv-rh-grid">
          {b27.commits.map((p, i) => (
            <CommitCard key={ensurePlayerSlug(p.slug, p.name)} player={p} rank={i + 1} />
          ))}
          {b27.commits.length === 0 && <UiEmpty message="No 2027 commits yet." />}
        </div>
      )}

      {!loading && !error && tab === 'targets-2026' && (
        <div className="gv-rh-grid">
          {b26.targets.map((p, i) => (
            <TargetCard key={ensurePlayerSlug(p.slug, p.name)} player={p} rank={i + 1} />
          ))}
          {b26.targets.length === 0 && <UiEmpty message="No 2026 targets." />}
        </div>
      )}

      {!loading && !error && tab === 'targets-2027' && (
        <div className="gv-rh-grid">
          {b27.targets.map((p, i) => (
            <TargetCard key={ensurePlayerSlug(p.slug, p.name)} player={p} rank={i + 1} />
          ))}
          {b27.targets.length === 0 && <UiEmpty message="No 2027 targets." />}
        </div>
      )}

      {!loading && !error && tab === 'heat' && (
        <div className="gv-rh-heat">
          <div className="gv-heat-columns">
            <div>
              <h2 className="gv-vault-alerts__section-title">Trending Up</h2>
              {rising.map((item, i) => (
                <HeatCard key={`${item.playerName}-${i}`} item={item} direction="up" />
              ))}
              {rising.length === 0 && <UiEmpty message="No risers right now." />}
            </div>
            <div>
              <h2 className="gv-vault-alerts__section-title">Trending Down</h2>
              {cooling.map((item, i) => (
                <HeatCard key={`${item.playerName}-${i}`} item={item} direction="down" />
              ))}
            </div>
          </div>
          <section className="gv-rh-staff-meter">
            <h2 className="gv-vault-alerts__section-title">Staff Confidence Meter</h2>
            <p className="gv-page-subtitle">
              High-tier targets with staff grades appear in Scouting. Movement signals feed FutureCast.
            </p>
            <IntelSummary risers={intel.risers} fallers={intel.fallers} volatile={intel.volatile} />
          </section>
        </div>
      )}

      {!loading && !error && tab === 'scouting' && (
        <div className="gv-rh-scouting">
          <ScoutingDepartmentPage inVault />
        </div>
      )}

      {!loading && !error && tab === 'portal' && (
        <div className="gv-rh-portal">
          <a
            href={playerProfilePath(ACE_PORTAL_SLUG, 'ROSTER', true)}
            className="gv-rh-portal-ace"
          >
            <span className="gv-rh-portal-ace__badge">ACE Portal Get</span>
            <strong>Eric Singleton Jr.</strong>
            <span>WR · Georgia Tech / Auburn transfer · WR1</span>
          </a>
          <h2 className="gv-vault-alerts__section-title">Incoming Transfers ({portal.length})</h2>
          <ul className="gv-portal-incoming__list">
            {portal.map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'PORTAL', true, p.fullName)} className="gv-portal-incoming__row">
                  <span className="gv-portal-incoming__name">{p.fullName}</span>
                  <span className="gv-portal-incoming__meta">
                    {p.position} · {p.classYear}
                    {p.previousSchool ? ` · from ${p.previousSchool}` : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <h2 className="gv-vault-alerts__section-title">Portal Watchlist</h2>
          <PortalWatchlistGrid query={{ limit: 12, sort: 'likelihood' }} />
        </div>
      )}

      {!loading && !error && tab === 'intel' && (
        <IntelSummary risers={intel.risers} fallers={intel.fallers} volatile={intel.volatile} />
      )}

      {!loading && !error && tab === 'rankings' && (
        <div className="gv-rh-rankings">
          <h2 className="gv-vault-alerts__section-title">Priority Rankings (All Targets)</h2>
          <div className="gv-rh-grid">
            {rankings.slice(0, 40).map((p, i) => (
              <TargetCard key={ensurePlayerSlug(p.slug, p.name)} player={p} rank={i + 1} />
            ))}
          </div>
          {rankings.length === 0 && <UiEmpty message="No ranked targets." />}
        </div>
      )}
    </div>
  );
}
