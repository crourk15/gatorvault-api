/**
 * UF Fit Watchlist grid — GET /api/uf-fit/watchlist (Best Fits Big Board cards).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  VaultBigBoardCard,
  modelFromBestFits,
} from '@/components/futurecast/VaultBigBoardCard';
import {
  fetchUfFitWatchlist,
  type UfFitWatchlistPlayer,
  type UfFitWatchlistQuery,
} from '../../lib/uf-fit-api';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';

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
      // Belt-and-suspenders: Best Fits must never render UF commits as open targets.
      setPlayers(
        (data.players || []).filter((p) =>
          isActiveUfTarget({
            slug: p.slug,
            committedTo: p.committedTo,
            classYear: p.classYear,
          })
        )
      );
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
    <div className="gv-rb-grid gv-chase-card-grid" data-testid="uf-fit-watchlist-grid">
      {players.map((p) => (
        <VaultBigBoardCard key={p.id} model={modelFromBestFits(p)} profileContext="futurecast" />
      ))}
    </div>
  );
}
