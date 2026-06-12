/**
 * Portal Watchlist grid — GET /api/portal/watchlist
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchPortalWatchlist,
  portalLikelihoodBand,
  portalLikelihoodPct,
  type PortalWatchlistPlayer,
  type PortalWatchlistQuery,
} from '../../lib/portal-api';

export interface PortalWatchlistGridProps {
  query: PortalWatchlistQuery;
}

export function PortalWatchlistGrid({ query }: PortalWatchlistGridProps): React.ReactElement {
  const [players, setPlayers] = useState<PortalWatchlistPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPortalWatchlist(query);
      setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="fc-big-board-empty">Loading Portal Watchlist…</div>;
  if (error) return <div className="fc-big-board-error">{error}</div>;
  if (!players.length) return <div className="fc-big-board-empty">No portal candidates match these filters.</div>;

  return (
    <div className="fc-portal-grid" data-testid="portal-watchlist-grid">
      {players.map((p) => {
        const pct = portalLikelihoodPct(p.portalLikelihood);
        const band = portalLikelihoodBand(pct);
        return (
          <a
            key={p.id}
            href={`/futurecast/player/${p.slug}?tab=portal`}
            className="fc-portal-card"
          >
            <span className="fc-portal-card__rank">#{p.rank}</span>
            <h3 className="fc-portal-card__name">{p.fullName}</h3>
            <p className="fc-portal-card__meta">
              {p.position} · {p.classYear}
            </p>
            <div className="fc-portal-card__scores">
              <span className={`fc-portal-badge fc-portal-badge--${band}`}>
                Portal {pct}%
              </span>
              <span className="fc-portal-metric">Risk {p.depthChartRisk}</span>
              <span className="fc-portal-metric">Vol {p.volatility}</span>
              {p.snapShare != null && (
                <span className="fc-portal-metric">Snaps {(p.snapShare * 100).toFixed(0)}%</span>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
