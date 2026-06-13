'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBigBoard, type BigBoardPlayer } from '@/lib/big-board-api';

export function PlayerDirectoryPage(): React.ReactElement {
  const [players, setPlayers] = useState<BigBoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classYear, setClassYear] = useState(2027);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBigBoard({
        class_year: classYear,
        lifecycle: 'HS',
        sort: 'rank',
        limit: 200,
      });
      setPlayers(data.players || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load player directory.');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [classYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const hay = [p.fullName, p.slug, p.position, String(p.classYear)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [players, search]);

  return (
    <div className="gv-page" data-testid="players-directory-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Player Directory</h1>
        <p className="gv-page-subtitle">
          {classYear} recruiting class — searchable profiles with FutureCast intel.
        </p>
      </div>

      <div className="gv-page-toolbar">
        <input
          type="search"
          className="gv-page-search"
          placeholder="Search by name or position…"
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

      {loading && <p className="gv-page-status">Loading players…</p>}
      {error && !loading && <p className="gv-page-error">{error}</p>}

      {!loading && !error && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">Recruits</h2>
            <p className="gv-page-section__subtitle">{filtered.length} players</p>
          </div>
          {filtered.length > 0 ? (
            <div className="gv-board-grid">
              {filtered.map((p) => (
                <a
                  key={p.id}
                  href={`/player/${encodeURIComponent(p.slug)}`}
                  className="gv-board-card gv-board-card--directory"
                >
                  <span className="gv-board-card__rank">#{p.rank}</span>
                  <h3 className="gv-board-card__name">{p.fullName}</h3>
                  <p className="gv-board-card__school">
                    {p.position} · Class of {p.classYear}
                  </p>
                  <div className="gv-board-card__meta">
                    <span className="gv-board-card__rating">Fit {p.ufFitScore}</span>
                    {p.signalCount > 0 && (
                      <span className="gv-board-card__signals">{p.signalCount} signals</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="gv-page-empty">No players match your search.</p>
          )}
        </section>
      )}
    </div>
  );
}
