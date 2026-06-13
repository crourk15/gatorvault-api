'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRecruitingBoard,
  TIER_ORDER,
  TIER_LABELS,
  type RecruitingBoardPlayer,
  type RecruitingBoardTier,
  type RecruitingBoardResponse,
} from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck } from '@/lib/recruiting-api';
import { fetchStaffDashboard } from '@/lib/staff-api';
import {
  type BoardSortMode,
  type BoardViewMode,
  playerPos,
  selectHeadliner,
  sortBoardPlayers,
} from '@/lib/recruiting-board-utils';
import { ClassHeadlinerHero, ClassSummaryBar } from '@/components/vault/RecruitingBoardClassic';
import { RatingRecruitCard } from '@/components/vault/RatingRecruitCard';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type TierFilter = 'all' | RecruitingBoardTier;

function enrichWithIntel(
  players: RecruitingBoardPlayer[],
  deltaBySlug: Map<string, number>,
  predictionBySlug: Map<string, { school: string; pct: number }>
): RecruitingBoardPlayer[] {
  return players.map((p) => {
    const delta = deltaBySlug.get(p.slug);
    let movementDirection: 'up' | 'down' | 'flat' | undefined;
    if (delta != null) {
      if (delta > 0) movementDirection = 'up';
      else if (delta < 0) movementDirection = 'down';
      else movementDirection = 'flat';
    }
    const pred = predictionBySlug.get(p.slug);
    return {
      ...p,
      movementDirection,
      predictionSchools: pred ? [pred] : p.predictionSchools,
    };
  });
}

export function VaultRecruitingBoardPage(): React.ReactElement {
  const [classYear, setClassYear] = useState(2027);
  const [viewMode, setViewMode] = useState<BoardViewMode>('all');
  const [commits, setCommits] = useState<RecruitingBoardPlayer[]>([]);
  const [targets, setTargets] = useState<RecruitingBoardPlayer[]>([]);
  const [boardRankings, setBoardRankings] = useState<RecruitingBoardResponse['rankings']>(null);
  const [compareRankings, setCompareRankings] = useState<
    { nationalRank?: number; secRank?: number; classScore?: number } | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<BoardSortMode>('rating');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [starsFilter, setStarsFilter] = useState('all');
  const [priorityOnly, setPriorityOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, compare, staff, heat] = await Promise.all([
        fetchRecruitingBoard(classYear),
        fetchRecruitingBoard(classYear - 1).catch(() => null),
        fetchStaffDashboard().catch(() => null),
        fetchRecruitingHeatCheck().catch(() => null),
      ]);

      const deltaBySlug = new Map<string, number>();
      if (staff && !staff.unavailable) {
        for (const p of [...staff.topRisers, ...staff.topFallers, ...staff.highVolatility]) {
          if (p.slug && p.delta != null) deltaBySlug.set(p.slug, p.delta);
        }
      }

      const predictionBySlug = new Map<string, { school: string; pct: number }>();
      for (const item of [...(heat?.rising ?? []), ...(heat?.cooling ?? [])]) {
        if (item.playerSlug && item.predictionSchool) {
          predictionBySlug.set(item.playerSlug, { school: item.predictionSchool, pct: 75 });
        }
      }

      setCommits(enrichWithIntel(board.commits ?? [], deltaBySlug, predictionBySlug));
      setTargets(enrichWithIntel(board.targets ?? [], deltaBySlug, predictionBySlug));
      setBoardRankings(board.rankings ?? null);
      setCompareRankings(compare?.rankings ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting board.');
      setCommits([]);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [classYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const positions = useMemo(() => {
    const all = [...commits, ...targets];
    const set = new Set(all.map((p) => playerPos(p)).filter((p) => p !== '—'));
    return [...set].sort();
  }, [commits, targets]);

  const states = useMemo(() => {
    const all = [...commits, ...targets];
    const set = new Set(all.map((p) => p.state).filter(Boolean) as string[]);
    return [...set].sort();
  }, [commits, targets]);

  const filterList = useCallback(
    (list: RecruitingBoardPlayer[]) => {
      const q = search.trim().toLowerCase();
      let out = list;
      if (priorityOnly) {
        out = out.filter((p) => p.tier === 'TOP' || p.headliner);
      }
      if (q) {
        out = out.filter((p) =>
          [p.name, p.school, playerPos(p), p.state, p.slug, p.skinny]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        );
      }
      if (tierFilter !== 'all') out = out.filter((p) => p.tier === tierFilter);
      if (positionFilter !== 'all') out = out.filter((p) => playerPos(p) === positionFilter);
      if (stateFilter !== 'all') out = out.filter((p) => p.state === stateFilter);
      if (starsFilter !== 'all') {
        const min = Number(starsFilter);
        out = out.filter((p) => (Number(p.stars) || 0) >= min);
      }
      return sortBoardPlayers(out, sort);
    },
    [search, sort, tierFilter, positionFilter, stateFilter, starsFilter, priorityOnly]
  );

  const filteredCommits = useMemo(() => filterList(commits), [commits, filterList]);
  const filteredTargets = useMemo(() => filterList(targets), [targets, filterList]);
  const headliner = useMemo(() => selectHeadliner(commits), [commits]);

  const showCommits = viewMode === 'all' || viewMode === 'commits';
  const showTargets = viewMode === 'all' || viewMode === 'targets';

  return (
    <div className="gv-rb-page" data-testid="vault-recruiting-board">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Board</h1>
        <p className="gv-page-subtitle">
          {classYear} class — On3/Rivals composite ratings, commits, targets, and scouting intel.
        </p>
        <div className="gv-rb-page__links">
          <a href="/vault/recruiting">Recruiting Hub →</a>
          <a href="/vault/futurecast">FutureCast →</a>
          <a href="/vault/recruiting/priority">High Priority →</a>
        </div>
      </div>

      <div className="gv-page-toolbar gv-rb-toolbar">
        <input
          type="search"
          className="gv-page-search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="gv-page-select"
          value={classYear}
          onChange={(e) => setClassYear(Number(e.target.value))}
        >
          <option value={2027}>Class of 2027</option>
          <option value={2028}>Class of 2028</option>
        </select>
        <select
          className="gv-page-select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as BoardViewMode)}
        >
          <option value="all">Commits + Targets</option>
          <option value="commits">Commits Only</option>
          <option value="targets">Targets Only</option>
        </select>
        <select className="gv-page-select" value={sort} onChange={(e) => setSort(e.target.value as BoardSortMode)}>
          <option value="rating">Sort: Composite Rating</option>
          <option value="natl">Sort: National Rank</option>
          <option value="ufProbability">Sort: UF Probability</option>
          <option value="fitScore">Sort: Fit Score</option>
          <option value="stars">Sort: Stars</option>
          <option value="name">Sort: Name</option>
        </select>
        <select
          className="gv-page-select"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as TierFilter)}
        >
          <option value="all">All Tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          className="gv-page-select"
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
        >
          <option value="all">All Positions</option>
          {positions.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <select
          className="gv-page-select"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="all">All States</option>
          {states.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <select
          className="gv-page-select"
          value={starsFilter}
          onChange={(e) => setStarsFilter(e.target.value)}
        >
          <option value="all">All Stars</option>
          <option value="5">5★+</option>
          <option value="4">4★+</option>
          <option value="3">3★+</option>
        </select>
        <label className="gv-rb-priority-toggle">
          <input
            type="checkbox"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
          />
          High Priority only
        </label>
      </div>

      {loading && <p className="gv-page-status">Loading recruiting board…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault/recruiting" backLabel="← Recruiting Hub" />
      )}

      {!loading && !error && (
        <>
          <ClassSummaryBar
            commits={commits}
            rankings={boardRankings}
            classYear={classYear}
            compareRankings={compareRankings ?? undefined}
          />

          {headliner && viewMode !== 'targets' && <ClassHeadlinerHero player={headliner} />}

          {showCommits && (
            <section className="gv-rb-section">
              <div className="gv-page-section__header">
                <h2 className="gv-page-section__title">🟢 {classYear} Commits</h2>
                <span className="gv-page-section__badge">{filteredCommits.length}</span>
              </div>
              {filteredCommits.length > 0 ? (
                <div className="gv-rb-grid">
                  {filteredCommits.map((p) => (
                    <RatingRecruitCard key={p.slug} player={p} variant="commit" />
                  ))}
                </div>
              ) : (
                <UiEmpty message="No commits match your filters." />
              )}
            </section>
          )}

          {showTargets && (
            <section className="gv-rb-section">
              <div className="gv-page-section__header">
                <h2 className="gv-page-section__title">🎯 {classYear} Targets</h2>
                <span className="gv-page-section__badge">{filteredTargets.length}</span>
              </div>
              {filteredTargets.length > 0 ? (
                <div className="gv-rb-grid">
                  {filteredTargets.map((p) => (
                    <RatingRecruitCard key={p.slug} player={p} variant="target" />
                  ))}
                </div>
              ) : (
                <UiEmpty message="No targets match your filters." />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
