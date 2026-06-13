'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBigBoard, type BigBoardLifecycle, type BigBoardPlayer, type BigBoardSort } from '@/lib/big-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const LIFECYCLE_TABS: { id: BigBoardLifecycle; label: string }[] = [
  { id: 'HS', label: 'Recruits (HS)' },
  { id: 'PORTAL', label: 'Portal' },
  { id: 'COLLEGE', label: 'College' },
];

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB', 'ATH', 'K', 'P'];

export function PlayerDirectoryPage({ inVault = false }: { inVault?: boolean } = {}): React.ReactElement {
  const [players, setPlayers] = useState<BigBoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classYear, setClassYear] = useState(2027);
  const [lifecycle, setLifecycle] = useState<BigBoardLifecycle>('HS');
  const [position, setPosition] = useState('ALL');
  const [sort, setSort] = useState<BigBoardSort>('rank');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBigBoard({
        class_year: classYear,
        lifecycle,
        sort,
        order: sort === 'name' ? 'asc' : 'desc',
        position: position !== 'ALL' ? position : undefined,
        limit: 250,
      });
      setPlayers(data.players || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load player directory.');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [classYear, lifecycle, position, sort]);

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

  const sectionLabel =
    lifecycle === 'HS' ? 'High School Recruits' : lifecycle === 'PORTAL' ? 'Portal Players' : 'College Players';

  return (
    <div className="gv-page" data-testid="players-directory-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Player Directory</h1>
        <p className="gv-page-subtitle">
          Searchable profiles — HS recruits open in FutureCast; portal and college players have dedicated profiles.
        </p>
      </div>

      <div className="gv-page-tabs">
        {LIFECYCLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`gv-page-tab${lifecycle === tab.id ? ' is-active' : ''}`}
            onClick={() => setLifecycle(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="gv-page-toolbar">
        <input
          type="search"
          className="gv-page-search"
          placeholder="Search by name or position…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="gv-page-select" value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
          <option value={2027}>Class of 2027</option>
          <option value={2026}>Class of 2026</option>
          <option value={2028}>Class of 2028</option>
        </select>
        <select className="gv-page-select" value={position} onChange={(e) => setPosition(e.target.value)}>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos === 'ALL' ? 'All Positions' : pos}
            </option>
          ))}
        </select>
        <select className="gv-page-select" value={sort} onChange={(e) => setSort(e.target.value as BigBoardSort)}>
          <option value="rank">Sort: Rank</option>
          <option value="ufFit">Sort: Fit Score</option>
          <option value="portalLikelihood">Sort: Portal %</option>
          <option value="signals">Sort: Signals</option>
          <option value="name">Sort: Name</option>
          <option value="position">Sort: Position</option>
        </select>
      </div>

      {loading && <p className="gv-page-status">Loading players…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/scouting" backLabel="← Scouting" />
      )}

      {!loading && !error && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">{sectionLabel}</h2>
            <p className="gv-page-section__subtitle">{filtered.length} players</p>
          </div>
          {filtered.length > 0 ? (
            <div className="gv-board-grid">
              {filtered.map((p) => (
                <a
                  key={p.id}
                  href={playerProfilePath(p.slug, p.lifecycle, inVault)}
                  className="gv-board-card gv-board-card--directory"
                >
                  <span className="gv-board-card__rank">#{p.rank}</span>
                  <h3 className="gv-board-card__name">{p.fullName}</h3>
                  <p className="gv-board-card__school">
                    {p.position} · Class of {p.classYear} · {p.lifecycle}
                  </p>
                  <div className="gv-board-card__meta">
                    {p.lifecycle === 'HS' && (
                      <span className="gv-board-card__rating">Fit {p.ufFitScore}</span>
                    )}
                    {(p.lifecycle === 'PORTAL' || p.lifecycle === 'COLLEGE') && p.portalLikelihood > 0 && (
                      <span className="gv-board-card__rating">Portal {p.portalLikelihood}%</span>
                    )}
                    {p.signalCount > 0 && (
                      <span className="gv-board-card__signals">{p.signalCount} signals</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <UiEmpty message="No players match your search." hint="Try a different class year or lifecycle tab." />
          )}
        </section>
      )}
    </div>
  );
}
