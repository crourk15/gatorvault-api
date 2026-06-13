'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRecruitingBoard,
  type RecruitingBoardPlayer,
} from '@/lib/recruiting-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type SortMode = 'rating' | 'rank' | 'name' | 'tier';
type TierFilter = 'all' | '1' | '2' | '3' | '4';
type EvalFilter = 'all' | 'signed' | 'priority' | 'monitoring';

function playerPos(p: RecruitingBoardPlayer): string {
  return p.pos || p.position || '—';
}

function playerRating(p: RecruitingBoardPlayer): number {
  const raw = p.displayRating ?? p.vaultGrade ?? p.rating;
  return raw != null ? Number(raw) : 0;
}

function priorityTier(p: RecruitingBoardPlayer): 1 | 2 | 3 | 4 {
  const stars = p.stars || 0;
  const rating = playerRating(p);
  if (stars >= 5 || rating >= 0.98) return 1;
  if (stars >= 4 || rating >= 0.9) return 2;
  if (stars >= 3 || rating >= 0.85) return 3;
  return 4;
}

function tierLabel(tier: number): string {
  if (tier === 1) return 'Tier 1';
  if (tier === 2) return 'Tier 2';
  if (tier === 3) return 'Tier 3';
  return 'Tier 4';
}

function evalStatus(p: RecruitingBoardPlayer, variant: 'commit' | 'target'): string {
  if (variant === 'commit') return 'Signed';
  const ov = String(p.ufOvStatus || '').toUpperCase();
  if (ov.includes('OFFER')) return 'Offer Out';
  if (ov.includes('VISIT')) return 'Visit Scheduled';
  if (priorityTier(p) <= 2) return 'Priority Eval';
  return 'Monitoring';
}

function RecruitCard({
  player,
  variant,
}: {
  player: RecruitingBoardPlayer;
  variant: 'commit' | 'target';
}): React.ReactElement {
  const stars = player.stars ? '★'.repeat(Math.min(5, player.stars)) : '';
  const tier = priorityTier(player);
  const note = player.skinny || player.profileNote;
  const href = playerProfilePath(player.slug, 'HS');

  return (
    <article className={`gv-board-card gv-board-card--${variant}`}>
      <div className="gv-board-card__top">
        <span className={`gv-board-tier gv-board-tier--${tier}`}>{tierLabel(tier)}</span>
        <span className={`gv-board-eval gv-board-eval--${variant}`}>{evalStatus(player, variant)}</span>
      </div>
      <a href={href} className="gv-board-card__link-block">
        <div className="gv-board-card__top">
          <h3 className="gv-board-card__name">{player.name}</h3>
          <span className="gv-board-card__pos">{playerPos(player)}</span>
        </div>
        <p className="gv-board-card__school">{player.school || '—'}</p>
        {player.htWt && <p className="gv-board-card__meas">{player.htWt}</p>}
        <div className="gv-board-card__meta">
          {stars && <span className="gv-board-card__stars">{stars}</span>}
          {playerRating(player) > 0 && (
            <span className="gv-board-card__rating">{playerRating(player).toFixed(4)}</span>
          )}
        </div>
        {(player.natl ?? player.natlRank) != null && (
          <p className="gv-board-card__ranks">
            Natl #{player.natl ?? player.natlRank}
            {(player.posRk ?? player.posRank) != null && ` · Pos #${player.posRk ?? player.posRank}`}
          </p>
        )}
      </a>
      {note && <p className="gv-board-card__note">{note}</p>}
    </article>
  );
}

function sortPlayers(list: RecruitingBoardPlayer[], sort: SortMode): RecruitingBoardPlayer[] {
  const copy = [...list];
  if (sort === 'name') {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === 'tier') {
    return copy.sort((a, b) => priorityTier(a) - priorityTier(b) || playerRating(b) - playerRating(a));
  }
  if (sort === 'rank') {
    return copy.sort((a, b) => {
      const an = a.natl ?? a.natlRank;
      const bn = b.natl ?? b.natlRank;
      if (an != null && bn != null) return Number(an) - Number(bn);
      return playerRating(b) - playerRating(a);
    });
  }
  return copy.sort((a, b) => playerRating(b) - playerRating(a));
}

export function RecruitingBoardPage(): React.ReactElement {
  const [commits, setCommits] = useState<RecruitingBoardPlayer[]>([]);
  const [targets, setTargets] = useState<RecruitingBoardPlayer[]>([]);
  const [classYear, setClassYear] = useState(2027);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('tier');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [evalFilter, setEvalFilter] = useState<EvalFilter>('all');
  const [show, setShow] = useState<'all' | 'commits' | 'targets'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecruitingBoard(classYear);
      setCommits(data.commits || []);
      setTargets(data.targets || []);
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

  const applyFilters = useCallback(
    (list: RecruitingBoardPlayer[], variant: 'commit' | 'target') => {
      const q = search.trim().toLowerCase();
      let out = list;
      if (q) {
        out = out.filter((p) => {
          const hay = [p.name, p.school, playerPos(p), p.slug, p.skinny, p.profileNote]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
      }
      if (tierFilter !== 'all') {
        const tier = Number(tierFilter);
        out = out.filter((p) => priorityTier(p) === tier);
      }
      if (evalFilter !== 'all') {
        out = out.filter((p) => {
          const status = evalStatus(p, variant).toLowerCase();
          if (evalFilter === 'signed') return status === 'signed';
          if (evalFilter === 'priority') return status.includes('priority') || status.includes('offer') || status.includes('visit');
          return status === 'monitoring';
        });
      }
      return sortPlayers(out, sort);
    },
    [search, sort, tierFilter, evalFilter]
  );

  const filteredCommits = useMemo(() => applyFilters(commits, 'commit'), [commits, applyFilters]);
  const filteredTargets = useMemo(() => applyFilters(targets, 'target'), [targets, applyFilters]);

  return (
    <div className="gv-page" data-testid="recruiting-board-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Board</h1>
        <p className="gv-page-subtitle">
          Florida Gators commits and targets — {classYear} class with priority tiers, staff notes, and eval status.
        </p>
      </div>

      <div className="gv-page-tabs">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'commits', label: 'Commits' },
            { id: 'targets', label: 'Targets' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`gv-page-tab${show === tab.id ? ' is-active' : ''}`}
            onClick={() => setShow(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="gv-page-toolbar">
        <input
          type="search"
          className="gv-page-search"
          placeholder="Search players, schools, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="gv-page-select" value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
          <option value={2027}>Class of 2027</option>
          <option value={2026}>Class of 2026</option>
          <option value={2028}>Class of 2028</option>
        </select>
        <select className="gv-page-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
          <option value="tier">Sort: Priority Tier</option>
          <option value="rating">Sort: Rating</option>
          <option value="rank">Sort: National Rank</option>
          <option value="name">Sort: Name</option>
        </select>
        <select className="gv-page-select" value={tierFilter} onChange={(e) => setTierFilter(e.target.value as TierFilter)}>
          <option value="all">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
          <option value="4">Tier 4</option>
        </select>
        <select className="gv-page-select" value={evalFilter} onChange={(e) => setEvalFilter(e.target.value as EvalFilter)}>
          <option value="all">All Eval Status</option>
          <option value="signed">Signed</option>
          <option value="priority">Priority / Offer / Visit</option>
          <option value="monitoring">Monitoring</option>
        </select>
      </div>

      {loading && <p className="gv-page-status">Loading recruiting board…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/" backLabel="← GatorVault Home" />
      )}

      {!loading && !error && (
        <>
          {(show === 'all' || show === 'commits') && (
            <section className="gv-page-section">
              <div className="gv-page-section__header">
                <h2 className="gv-page-section__title">UF Commits ({classYear})</h2>
                <p className="gv-page-section__subtitle">{filteredCommits.length} signed</p>
              </div>
              {filteredCommits.length > 0 ? (
                <div className="gv-board-grid">
                  {filteredCommits.map((p) => (
                    <RecruitCard key={p.slug} player={p} variant="commit" />
                  ))}
                </div>
              ) : (
                <UiEmpty message="No commits match your filters." />
              )}
            </section>
          )}

          {(show === 'all' || show === 'targets') && (
            <section className="gv-page-section">
              <div className="gv-page-section__header">
                <h2 className="gv-page-section__title">Top Targets ({classYear})</h2>
                <p className="gv-page-section__subtitle">{filteredTargets.length} on the board</p>
              </div>
              {filteredTargets.length > 0 ? (
                <div className="gv-board-grid">
                  {filteredTargets.map((p) => (
                    <RecruitCard key={p.slug} player={p} variant="target" />
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
