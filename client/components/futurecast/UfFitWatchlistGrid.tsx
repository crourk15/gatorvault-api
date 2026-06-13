/**
 * UF Fit Watchlist grid — GET /api/uf-fit/watchlist
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchUfFitWatchlist,
  fitTierLabel,
  formatFitDelta,
  type UfFitWatchlistPlayer,
  type UfFitWatchlistQuery,
} from '../../lib/uf-fit-api';

export interface UfFitWatchlistGridProps {
  query: UfFitWatchlistQuery;
}

export function UfFitWatchlistGrid({ query }: UfFitWatchlistGridProps): React.ReactElement {
  const [players, setPlayers] = useState<UfFitWatchlistPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUfFitWatchlist(query);
      setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load UF Fit watchlist');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="fc-big-board-empty">Loading UF Fit Watchlist…</div>;
  if (error) return <div className="fc-big-board-error">{error}</div>;
  if (!players.length) return <div className="fc-big-board-empty">No players match these filters.</div>;

  return (
    <div className="fc-uf-fit-grid" data-testid="uf-fit-watchlist-grid">
      {players.map((p) => (
        <a
          key={p.id}
          href={`/player/${p.slug}?tab=uf-fit`}
          className="fc-uf-fit-card"
        >
          <span className="fc-uf-fit-card__rank">#{p.rank}</span>
          <h3 className="fc-uf-fit-card__name">{p.fullName}</h3>
          <p className="fc-uf-fit-card__meta">{p.position} · {p.classYear}</p>
          <div className="fc-uf-fit-card__scores">
            <span className={`fc-fit-badge fc-fit-badge--${p.fitTier}`}>
              {fitTierLabel(p.fitTier)} · {p.ufFitScore}
            </span>
            <span className={`fc-uf-fit-delta${p.fitDelta >= 0 ? ' fc-uf-fit-delta--up' : ' fc-uf-fit-delta--down'}`}>
              Δ {formatFitDelta(p.fitDelta)}
            </span>
            <span className="fc-portal-metric">Vol {p.fitVolatility}</span>
          </div>
        </a>
      ))}
    </div>
  );
}
