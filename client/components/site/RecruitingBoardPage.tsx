'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRecruitingBoard,
  TIER_LABELS,
  TIER_ORDER,
  type RecruitingBoardPlayer,
  type RecruitingBoardTier,
} from '@/lib/recruiting-board-api';
import { playerPos } from '@/lib/recruiting-board-utils';
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
  const [sort, setSort] = useState<SortMode>('ufProbability');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const staffMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('mode') === 'staff' ||
      new URLSearchParams(window.location.search).get('staff') === '1');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecruitingBoard(classYear, staffMode);
      setPlayers(data.players || [...(data.commits || []), ...(data.targets || [])]);
      setEmptyMessage(data.empty ? data.message || 'No players found for this category yet.' : null);
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

  const positions = useMemo(() => {
    const set = new Set(players.map((p) => playerPos(p)).filter((p) => p !== '—'));
    return [...set].sort();
  }, [players]);

  const states = useMemo(() => {
    const set = new Set(players.map((p) => p.state).filter(Boolean) as string[]);
    return [...set].sort();
  }, [players]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [players, search, sort, tierFilter, positionFilter, stateFilter]);

  const tierSections = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      players: filtered.filter((p) => p.tier === tier),
    })).filter((section) => section.players.length > 0);
  }, [filtered]);

  return (
    <div className="gv-page" data-testid="recruiting-board-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Board</h1>
        <p className="gv-page-subtitle">
          {classYear} class — tiered priorities with UF probability, fit score, and staff grades.
        </p>
        {inVault && (
          <a href="/vault/futurecast" className="gv-vault-crosslink">
            Open FutureCast in Vault →
          </a>
        )}
      </div>

      <div className="gv-page-toolbar">
        <input
          type="search"
          className="gv-page-search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="gv-page-select" value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
          <option value={2027}>Class of 2027</option>
          <option value={2026}>Class of 2026</option>
          <option value={2028}>Class of 2028</option>
        </select>
        <select className="gv-page-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
          <option value="ufProbability">Sort: UF Probability</option>
          <option value="fitScore">Sort: Fit Score</option>
          <option value="staffGrade">Sort: Staff Grade</option>
          <option value="name">Sort: Name</option>
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

      {loading && <p className="gv-page-status">Loading recruiting board…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref={inVault ? '/vault' : '/'} />
      )}

      {!loading && !error && emptyMessage && tierSections.length === 0 && (
        <UiEmpty message={emptyMessage} />
      )}

      {!loading && !error && tierSections.map((section) => (
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
