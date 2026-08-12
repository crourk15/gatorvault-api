/**
 * Portal Watchlist grid — GET /api/portal/watchlist
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  VaultBigBoardCard,
  modelFromPortal,
} from '@/components/futurecast/VaultBigBoardCard';
import {
  fetchPortalWatchlist,
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
    <div className="gv-rb-grid gv-chase-card-grid" data-testid="portal-watchlist-grid">
      {players.map((p) => (
        <VaultBigBoardCard key={p.id} model={modelFromPortal(p)} profileContext="futurecast" />
      ))}
    </div>
  );
}
