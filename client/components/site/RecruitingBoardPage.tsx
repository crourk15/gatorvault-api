'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/recruiting-tracker.css';
import {
  fetchRecruitingBoard,
  TIER_LABELS,
  TIER_ORDER,
  type RecruitingBoardPlayer,
  type RecruitingBoardTier,
} from '@/lib/recruiting-board-api';
import { playerPos } from '@/lib/recruiting-board-utils';
import { useRecruitingData } from '@/hooks/use-recruiting-data';
import {
  filterTrackerPlayers,
  sortTrackerPlayers,
  type TrackerStatusFilter,
} from '@/lib/recruiting-tracker-api';
import { TrackerFilters } from '@/components/recruiting/tracker/TrackerFilters';
import { TrackerList } from '@/components/recruiting/tracker/TrackerList';
import { TrackerSkeleton } from '@/components/recruiting/tracker/TrackerSkeleton';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { resolveCardVariant } from '@/lib/recruiting-card-adapters';

type SortMode = 'ufProbability' | 'fitScore' | 'staffGrade' | 'name';
type TierFilter = 'all' | RecruitingBoardTier;

function sortPlayers(list: RecruitingBoardPlayer[], sort: SortMode): RecruitingBoardPlayer[] {
  const copy = [...list];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'staffGrade') {
    return copy.sort((a, b) => String(b.staffGrade ?? '').localeCompare(String(a.staffGrade ?? '')));
  }
  if (sort === 'fitScore') {
    return copy.sort((a, b) => (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0));
  }
  return copy.sort((a, b) => (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0));
}

export function RecruitingBoardPage({ inVault = false }: { inVault?: boolean }): React.ReactElement {
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);
  const [classYear, setClassYear] = useState(2027);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('ufProbability');
  const [trackerSort, setTrackerSort] = useState<'rating' | 'ranking' | 'name' | 'status'>('rating');
  const [statusFilter, setStatusFilter] = useState<TrackerStatusFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const staffMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('mode') === 'staff' ||
      new URLSearchParams(window.location.search).get('staff') === '1');

  const {
    players: trackerSource,
    loading: trackerLoading,
    error: trackerError,
    updatedAt: trackerUpdatedAt,
    reload: reloadTracker,
  } = useRecruitingData(classYear, staffMode);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const board = await fetchRecruitingBoard(classYear, staffMode);
      setPlayers(board.players || [...(board.commits || []), ...(board.targets || [])]);
      setEmptyMessage(board.empty ? board.message || 'No players found for this category yet.' : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting board.');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [classYear, staffMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageLoading = loading || trackerLoading;
  const pageError = error || trackerError;
  const lastUpdated = trackerUpdatedAt;

  const positions = useMemo(() => {
    const set = new Set(players.map((p) => playerPos(p)).filter((p) => p !== '—'));
    return [...set].sort();
  }, [players]);

  const states = useMemo(() => {
    const set = new Set(players.map((p) => p.state).filter(Boolean) as string[]);
    return [...set].sort();
  }, [players]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let out = players;
    if (q) {
      out = out.filter((p) =>
        [p.name, p.school, playerPos(p), p.state, p.slug, p.notePreview, p.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (tierFilter !== 'all') out = out.filter((p) => p.tier === tierFilter);
    if (positionFilter !== 'all') out = out.filter((p) => playerPos(p) === positionFilter);
    if (stateFilter !== 'all') out = out.filter((p) => p.state === stateFilter);
    return sortPlayers(out, sort);
  }, [players, debouncedSearch, sort, tierFilter, positionFilter, stateFilter]);

  const trackerPlayers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let out = trackerSource;
    if (q) {
      out = out.filter((p) =>
        [p.name, p.school, p.position, p.offerStatus, p.prediction]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    const statusFiltered = filterTrackerPlayers(out, statusFilter);
    return sortTrackerPlayers(statusFiltered, trackerSort);
  }, [trackerSource, debouncedSearch, statusFilter, trackerSort]);

  const tierSections = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      players: filtered.filter((p) => p.tier === tier),
    })).filter((section) => section.players.length > 0);
  }, [filtered]);

  return (
    <div className="gv-page tracker-page" data-testid="recruiting-board-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Tracker</h1>
        <p className="gv-page-subtitle">
          {classYear} class — live board with status tracking, ratings, and tiered priorities.
        </p>
        {inVault && (
          <a href="/vault/futurecast" className="gv-vault-crosslink">
            Open FutureCast in Vault →
          </a>
        )}
      </div>

      <TrackerFilters
        search={search}
        onSearchChange={setSearch}
        sort={trackerSort}
        onSortChange={setTrackerSort}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        classYear={classYear}
        onClassYearChange={setClassYear}
        lastUpdated={lastUpdated}
      />

      <div className="gv-page-toolbar">
        <select className="gv-page-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
          <option value="ufProbability">Tier sort: UF Probability</option>
          <option value="fitScore">Tier sort: Fit Score</option>
          <option value="staffGrade">Tier sort: Staff Grade</option>
          <option value="name">Tier sort: Name</option>
        </select>
        <select className="gv-page-select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value as TierFilter)}>
          <option value="all">All Tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select className="gv-page-select" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
          <option value="all">All Positions</option>
          {positions.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <select className="gv-page-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">All States</option>
          {states.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {pageLoading && <TrackerSkeleton rows={8} />}
      {pageError && !pageLoading && (
        <UiError
          message={pageError}
          retry={() => {
            void load();
            reloadTracker();
          }}
          backHref={inVault ? '/vault' : '/'}
        />
      )}

      {!pageLoading && !pageError && emptyMessage && trackerPlayers.length === 0 && (
        <UiEmpty message={emptyMessage} />
      )}

      {!pageLoading && !pageError && trackerPlayers.length > 0 && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">Board Tracker</h2>
            <span className="gv-page-section__badge">{trackerPlayers.length}</span>
          </div>
          <TrackerList players={trackerPlayers} />
        </section>
      )}

      {!pageLoading && !pageError &&
        tierSections.map((section) => (
          <section key={section.tier} className="gv-page-section">
            <div className="gv-page-section__header">
              <h2 className="gv-page-section__title">{section.label}</h2>
              <span className="gv-page-section__badge">{section.players.length}</span>
            </div>
            <div className="gv-rb-grid">
              {section.players.map((p) => (
                <ClassicRecruitCard
                  key={p.slug}
                  player={p}
                  variant={resolveCardVariant(p, p.isCommittedToUF ? 'commit' : 'target')}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
