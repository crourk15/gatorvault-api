'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRecruitingBoard,
  type RecruitingBoardPlayer,
} from '@/lib/recruiting-board-api';

function playerPos(p: RecruitingBoardPlayer): string {
  return p.pos || p.position || '—';
}

function RecruitCard({ player, variant }: { player: RecruitingBoardPlayer; variant: 'commit' | 'target' }): React.ReactElement {
  const stars = player.stars ? '★'.repeat(Math.min(5, player.stars)) : '';
  return (
    <a href={`/player/${encodeURIComponent(player.slug)}`} className={`gv-board-card gv-board-card--${variant}`}>
      <div className="gv-board-card__top">
        <h3 className="gv-board-card__name">{player.name}</h3>
        <span className="gv-board-card__pos">{playerPos(player)}</span>
      </div>
      <p className="gv-board-card__school">{player.school || '—'}</p>
      {player.htWt && <p className="gv-board-card__meas">{player.htWt}</p>}
      <div className="gv-board-card__meta">
        {stars && <span className="gv-board-card__stars">{stars}</span>}
        {player.rating != null && (
          <span className="gv-board-card__rating">{Number(player.rating).toFixed(1)}</span>
        )}
      </div>
      {(player.natl ?? player.natlRank) != null && (
        <p className="gv-board-card__ranks">
          Natl #{player.natl ?? player.natlRank}
          {(player.posRk ?? player.posRank) != null && ` · Pos #${player.posRk ?? player.posRank}`}
        </p>
      )}
    </a>
  );
}

export function RecruitingBoardPage(): React.ReactElement {
  const [commits, setCommits] = useState<RecruitingBoardPlayer[]>([]);
  const [targets, setTargets] = useState<RecruitingBoardPlayer[]>([]);
  const [classYear, setClassYear] = useState(2027);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const q = search.trim().toLowerCase();
  const filter = useCallback(
    (list: RecruitingBoardPlayer[]) =>
      !q
        ? list
        : list.filter((p) => {
            const hay = [p.name, p.school, playerPos(p), p.slug].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
          }),
    [q]
  );

  const filteredCommits = useMemo(() => filter(commits), [commits, filter]);
  const filteredTargets = useMemo(() => filter(targets), [targets, filter]);

  return (
    <div className="gv-page" data-testid="recruiting-board-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting Board</h1>
        <p className="gv-page-subtitle">
          Florida Gators commits and targets — {classYear} class.
        </p>
      </div>

      <div className="gv-page-toolbar">
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
          <option value={2026}>Class of 2026</option>
          <option value={2028}>Class of 2028</option>
        </select>
      </div>

      {loading && <p className="gv-page-status">Loading recruiting board…</p>}
      {error && !loading && <p className="gv-page-error">{error}</p>}

      {!loading && !error && (
        <>
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
              <p className="gv-page-empty">No commits match your search.</p>
            )}
          </section>

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
              <p className="gv-page-empty">No targets match your search.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
